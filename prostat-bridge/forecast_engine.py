#!/usr/bin/env python3
"""
Bridge forecast engine - computes monthly HVAC cost from weather data.
Port of the app's heatUtils + useMonthlyForecast logic.
Runs on the Pi so the HMI always shows current month's expected bill.
"""

import json
import logging
import math
from datetime import datetime, date
from typing import Optional

logger = logging.getLogger(__name__)

BTU_PER_KWH = 3412.14
BTU_PER_TON = 12000


def get_capacity_factor(temp_out: float, cutoff_temp: float = -15) -> float:
    """Capacity factor 0-1 based on outdoor temp. Below cutoff = 0."""
    if temp_out <= cutoff_temp:
        return 0.0
    if temp_out >= 47:
        return 1.0
    if temp_out < 17:
        factor = 0.64 - (17 - temp_out) * 0.01
        return max(0.0, factor)
    return 1.0 - (47 - temp_out) * 0.012


def get_base_cop_unscaled(temp_out: float) -> float:
    """Base COP curve shape before HSPF2 scaling."""
    if temp_out >= 47:
        return 4.8
    if temp_out >= 17:
        return 4.8 - (47 - temp_out) * 0.0867
    base_cop = 2.2 - (17 - temp_out) * 0.02
    return max(1.2, base_cop)


HSPF2_BIN_HOURS = [
    (62, 87), (57, 183), (52, 294), (47, 358), (42, 415), (37, 460),
    (33, 430), (28, 407), (23, 311), (18, 239), (13, 152), (8, 91),
    (3, 47), (-2, 20), (-7, 8), (-13, 3),
]


def get_cop_factor(temp_out: float, hspf2: float = 9.0) -> float:
    """COP scaled to match HSPF2 seasonal average."""
    base_cop = get_base_cop_unscaled(temp_out)
    total_weighted = sum(get_base_cop_unscaled(t) * h for t, h in HSPF2_BIN_HOURS)
    total_hours = sum(h for _, h in HSPF2_BIN_HOURS)
    base_seasonal_cop = total_weighted / total_hours
    target_seasonal_cop = (hspf2 * 1000) / BTU_PER_KWH
    scale = target_seasonal_cop / base_seasonal_cop
    return base_cop * scale


def get_defrost_penalty(outdoor_temp: float, humidity: float) -> float:
    """Defrost penalty multiplier (1.0 = no penalty)."""
    rh = humidity / 100.0
    temp_mult = 1.0
    if 36 <= outdoor_temp <= 40:
        temp_mult = 1.0
    elif 40 < outdoor_temp <= 45:
        temp_mult = 1.0 - ((outdoor_temp - 40) / 5) * 0.5
    elif 32 <= outdoor_temp < 36:
        temp_mult = 1.0 - ((36 - outdoor_temp) / 4) * 0.1
    elif 20 <= outdoor_temp < 32:
        temp_mult = 0.9 - ((32 - outdoor_temp) / 12) * 0.3
    elif outdoor_temp < 20:
        temp_mult = max(0.2, 0.6 - ((20 - outdoor_temp) / 30) * 0.4)
    elif outdoor_temp > 45:
        temp_mult = 0.5 - ((outdoor_temp - 45) / 5) * 0.4 if outdoor_temp <= 50 else 0.1
    base_penalty = 0.20 if (36 <= outdoor_temp <= 40 and rh >= 0.90) else 0.18 if (36 <= outdoor_temp <= 40 and rh >= 0.80) else 0.15
    penalty = base_penalty * rh * temp_mult
    if rh >= 0.95 and 32 <= outdoor_temp <= 42:
        penalty += (rh - 0.95) * 0.10 * temp_mult
    return max(1.0, min(2.0, 1 + penalty))


def compute_hourly_performance(
    tons: float,
    indoor_temp: float,
    design_heat_loss_btu: float,
    compressor_power: float,
    hspf2: float,
    outdoor_temp: float,
    humidity: float,
    dt_hours: float = 1.0,
    cutoff_temp: float = -15,
) -> tuple[float, float]:
    """Returns (hp_kwh, aux_kwh) for the timestep."""
    btu_loss_per_deg = design_heat_loss_btu / 70 if design_heat_loss_btu > 0 else 0
    temp_diff = max(0, indoor_temp - outdoor_temp)
    building_loss_btu_hr = btu_loss_per_deg * temp_diff
    capacity_factor = get_capacity_factor(outdoor_temp, cutoff_temp)
    available_capacity_btu_hr = tons * BTU_PER_TON * capacity_factor
    cop = get_cop_factor(outdoor_temp, hspf2)
    defrost = get_defrost_penalty(outdoor_temp, humidity)
    effective_cop = max(0.5, cop / defrost)
    delivered_hp_btu_hr = min(building_loss_btu_hr, available_capacity_btu_hr) if available_capacity_btu_hr > 0 else 0
    deficit_btu_hr = max(0, building_loss_btu_hr - delivered_hp_btu_hr)
    hp_kwh = (delivered_hp_btu_hr * dt_hours) / (effective_cop * BTU_PER_KWH) if delivered_hp_btu_hr > 0 else 0
    aux_kwh = (deficit_btu_hr / BTU_PER_KWH) * dt_hours
    return hp_kwh, aux_kwh


def calculate_heat_loss(
    square_feet: float,
    insulation_level: float,
    home_shape: float,
    ceiling_height: float,
    has_loft: bool = False,
) -> float:
    """Design heat loss BTU/hr at 70°F delta-T."""
    ceiling_mult = 1 + (ceiling_height - 8) * 0.1
    effective_sqft = square_feet * 0.65 if (has_loft and 1.2 <= home_shape < 1.3) else square_feet
    raw = effective_sqft * 22.67 * insulation_level * home_shape * ceiling_mult
    return round(raw / 1000) * 1000


def get_hourly_temp(low: float, high: float, avg: float, hour: int) -> float:
    """Sinusoidal daily temp: min at 6 AM, max at 2 PM."""
    phase = ((hour - 6) / 12) * math.pi
    temp_offset = math.cos(phase - math.pi) * ((high - low) / 2)
    return avg + temp_offset


async def fetch_weather_async(session, lat: float, lon: float, month: int, year: int) -> list[dict]:
    """Fetch complete month of weather (forecast + archive for past days)."""
    today = date.today()
    target_month = month
    target_year = year
    if target_month == 12:
        days_in_month = 31
    else:
        days_in_month = (date(target_year, target_month + 1, 1) - date(target_year, target_month, 1)).days

    # Fetch 15-day forecast
    forecast_url = (
        f"https://api.open-meteo.com/v1/forecast"
        f"?latitude={lat}&longitude={lon}"
        f"&daily=temperature_2m_max,temperature_2m_min"
        f"&hourly=relativehumidity_2m"
        f"&temperature_unit=fahrenheit&timezone=auto&forecast_days=15"
    )
    async with session.get(forecast_url) as resp:
        if not resp.ok:
            raise RuntimeError(f"Open-Meteo forecast error: {resp.status}")
        forecast_data = await resp.json()

    daily_time = forecast_data.get("daily", {}).get("time", [])
    daily_high = forecast_data.get("daily", {}).get("temperature_2m_max", [])
    daily_low = forecast_data.get("daily", {}).get("temperature_2m_min", [])
    hourly_time = forecast_data.get("hourly", {}).get("time", [])
    hourly_rh = forecast_data.get("hourly", {}).get("relativehumidity_2m", [])

    # Build humidity by day
    humidity_by_day = {}
    for i, dt_str in enumerate(daily_time):
        day_vals = []
        for j, ht in enumerate(hourly_time):
            if ht.startswith(dt_str):
                v = hourly_rh[j] if j < len(hourly_rh) else 60
                if v is not None:
                    day_vals.append(v)
        humidity_by_day[dt_str] = sum(day_vals) / len(day_vals) if day_vals else 60

    forecast_map = {}
    for i, dt_str in enumerate(daily_time):
        if i < len(daily_high) and i < len(daily_low):
            d = datetime.strptime(dt_str, "%Y-%m-%d").date()
            if d.month == target_month and d.year == target_year:
                forecast_map[d.day] = {
                    "high": daily_high[i],
                    "low": daily_low[i],
                    "avg": (daily_high[i] + daily_low[i]) / 2,
                    "humidity": humidity_by_day.get(dt_str, 60),
                }

    # Fetch actual weather for past days (current month only)
    is_current = target_month == today.month and target_year == today.year
    if is_current and today.day > 1:
        start_str = f"{target_year}-{target_month:02d}-01"
        end_str = f"{target_year}-{target_month:02d}-{today.day-1:02d}"
        archive_url = (
            f"https://archive-api.open-meteo.com/v1/archive"
            f"?latitude={lat}&longitude={lon}"
            f"&start_date={start_str}&end_date={end_str}"
            f"&daily=temperature_2m_max,temperature_2m_min"
            f"&timezone=auto&temperature_unit=fahrenheit"
        )
        try:
            async with session.get(archive_url) as resp:
                if resp.ok:
                    archive = await resp.json()
                    for i, dt_str in enumerate(archive.get("daily", {}).get("time", [])):
                        d = datetime.strptime(dt_str, "%Y-%m-%d").date()
                        if d.month == target_month:
                            hi = archive["daily"]["temperature_2m_max"][i]
                            lo = archive["daily"]["temperature_2m_min"][i]
                            if hi is not None and lo is not None:
                                forecast_map[d.day] = {
                                    "high": hi,
                                    "low": lo,
                                    "avg": (hi + lo) / 2,
                                    "humidity": 60,
                                }
        except Exception as e:
            logger.warning("Archive fetch failed: %s", e)

    # Build complete month (fill gaps with historical average placeholder)
    result = []
    for day in range(1, days_in_month + 1):
        if day in forecast_map:
            result.append({
                "day": day,
                "high": forecast_map[day]["high"],
                "low": forecast_map[day]["low"],
                "avg": forecast_map[day]["avg"],
                "humidity": forecast_map[day]["humidity"],
            })
        else:
            # No data - use 45°F avg as fallback
            result.append({
                "day": day,
                "high": 50,
                "low": 40,
                "avg": 45,
                "humidity": 60,
            })
    return result


def compute_monthly_forecast(
    weather_days: list[dict],
    settings: dict,
    month: int,
    year: int,
) -> dict:
    """
    Compute monthly cost from weather days and user settings.
    Returns payload compatible with last_forecast_summary.
    """
    square_feet = float(settings.get("squareFeet") or settings.get("square_feet") or 1500)
    insulation = float(settings.get("insulationLevel") or settings.get("insulation_level") or 1.0)
    home_shape = float(settings.get("homeShape") or settings.get("home_shape") or 1.0)
    ceiling_height = float(settings.get("ceilingHeight") or settings.get("ceiling_height") or 8)
    has_loft = bool(settings.get("hasLoft") or settings.get("has_loft") or False)
    primary_system = settings.get("primarySystem") or settings.get("primary_system") or "heatPump"
    winter_day = float(settings.get("winterThermostatDay") or settings.get("winter_thermostat_day") or 70)
    winter_night = float(settings.get("winterThermostatNight") or settings.get("winter_thermostat_night") or 68)
    utility_cost = float(settings.get("utilityCost") or settings.get("utility_cost") or 0.10)
    fixed_cost = float(settings.get("fixedElectricCost") or settings.get("fixed_electric_cost") or 0)
    baseload_kwh_per_day = float(settings.get("learnedBaseloadKwhPerDay") or settings.get("baseloadKwhPerDay") or 10)
    baseload_kwh_per_day = max(5, min(25, baseload_kwh_per_day))
    manual_hl = float(settings.get("manualHeatLoss") or settings.get("manual_heat_loss") or 0)
    analyzer_hl = float(settings.get("analyzerHeatLoss") or settings.get("analyzer_heat_loss") or 0)
    use_aux = bool(settings.get("useElectricAuxHeat") or settings.get("use_electric_aux_heat") or True)

    # Resolve heat loss (manual/analyzer are BTU/hr/°F; design = BTU/hr at 70°F delta)
    use_manual = settings.get("useManualHeatLoss") or settings.get("use_manual_heat_loss")
    use_analyzer = settings.get("useAnalyzerHeatLoss") or settings.get("use_analyzer_heat_loss")
    if use_manual and manual_hl > 0:
        design_heat_loss = manual_hl * 70
    elif use_analyzer and analyzer_hl > 0:
        design_heat_loss = analyzer_hl * 70
    else:
        design_heat_loss = calculate_heat_loss(square_feet, insulation, home_shape, ceiling_height, has_loft)

    # Heat pump params
    tons = float(settings.get("heatPumpTons") or settings.get("heat_pump_tons") or 2.0)
    efficiency = float(settings.get("efficiency") or settings.get("hspf2") or 9.0)
    compressor_power = tons * 1.0 * (15 / efficiency) if efficiency else tons * 1.67

    # Weighted indoor temp (16h day + 8h night)
    indoor_temp = winter_day * (16 / 24) + winter_night * (8 / 24)

    total_energy = 0.0
    total_aux = 0.0

    for wday in weather_days:
        low = wday["low"]
        high = wday["high"]
        avg = wday["avg"]
        humidity = wday.get("humidity", 60)
        day_energy = 0.0
        day_aux = 0.0
        for hour in range(24):
            hourly_temp = get_hourly_temp(low, high, avg, hour)
            hp_kwh, aux_kwh = compute_hourly_performance(
                tons=tons,
                indoor_temp=indoor_temp,
                design_heat_loss_btu=design_heat_loss,
                compressor_power=compressor_power,
                hspf2=efficiency,
                outdoor_temp=hourly_temp,
                humidity=humidity,
                dt_hours=1.0,
            )
            day_energy += hp_kwh
            if use_aux:
                day_aux += aux_kwh
                day_energy += aux_kwh
        total_energy += day_energy
        total_aux += day_aux

    days_in_month = len(weather_days)
    hvac_cost = total_energy * utility_cost
    baseload_cost = baseload_kwh_per_day * days_in_month * utility_cost
    total_with_fees = hvac_cost + baseload_cost + fixed_cost

    location = settings.get("location") or {}
    if isinstance(location, dict):
        city = location.get("city") or location.get("name", "")
        state = location.get("state", "")
        loc_str = f"{city}, {state}" if city or state else "Unknown"
    else:
        loc_str = str(location) if location else "Unknown"

    return {
        "location": loc_str,
        "totalMonthlyCost": round(total_with_fees, 2),
        "variableCost": round(hvac_cost + baseload_cost, 2),
        "hvacCost": round(hvac_cost, 2),
        "baseloadCost": round(baseload_cost, 2),
        "fixedCost": round(fixed_cost, 2),
        "totalHPCost": round(total_with_fees / 4.33, 2),
        "totalHPCostWithAux": round(total_with_fees / 4.33, 2),
        "timestamp": int(datetime.now().timestamp() * 1000),
        "source": "bridge_forecast",
        "month": month,
        "targetTemp": indoor_temp,
        "nightTemp": winter_night,
        "mode": "heating",
        "totalEnergyKwh": round(total_energy, 1),
        "auxEnergyKwh": round(total_aux, 1),
        "hpEnergyKwh": round(total_energy - total_aux, 1),
        "electricityRate": utility_cost,
    }
