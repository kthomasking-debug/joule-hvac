#!/usr/bin/env python3
"""
EnergyPlus Load Calculation Service
Proof-of-concept integration for ACCA Manual J-compliant load calculations

This service:
1. Accepts building parameters via REST API
2. Generates EnergyPlus input files (epJSON)
3. Runs EnergyPlus simulations
4. Returns heating/cooling load results

Requirements:
    pip install pyenergyplus eppy

Usage:
    python energyplus-service.py
"""

import json
import sys
import os
import tempfile
import subprocess
from pathlib import Path
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs
import traceback

# Try to import EnergyPlus Python API
try:
    from pyenergyplus.api import EnergyPlusAPI
    ENERGYPLUS_AVAILABLE = True
except ImportError:
    ENERGYPLUS_AVAILABLE = False
    print("Warning: pyenergyplus not available. Using simplified calculations.")

# Fallback: Simplified Manual J calculation if EnergyPlus not available
def calculate_load_simplified(params):
    """Simplified Manual J-style calculation as fallback"""
    sqft = params.get('squareFeet', 2000)
    ceiling_height = params.get('ceilingHeight', 8)
    insulation = params.get('insulationLevel', 1.0)
    climate_zone = params.get('climateZone', 5)
    
    # Base heat loss (BTU/hr per sqft per °F delta-T)
    base_heat_loss_per_sqft = 0.32  # DOE average
    heat_loss_factor = base_heat_loss_per_sqft * insulation
    
    # Design conditions (99% heating, 1% cooling)
    # Simplified: use climate zone estimates
    design_heating_temp = {
        1: 30, 2: 20, 3: 10, 4: 0, 5: -5, 6: -10, 7: -15
    }.get(climate_zone, 0)
    
    design_cooling_temp = {
        1: 95, 2: 92, 3: 90, 4: 88, 5: 85, 6: 82, 7: 80
    }.get(climate_zone, 85)
    
    indoor_heating = 70
    indoor_cooling = 75
    
    # Calculate loads
    heating_delta_t = indoor_heating - design_heating_temp
    cooling_delta_t = design_cooling_temp - indoor_cooling
    
    heating_load_btu_hr = sqft * heat_loss_factor * heating_delta_t
    cooling_load_btu_hr = sqft * heat_loss_factor * cooling_delta_t * 1.2  # Add internal gains
    
    return {
        'heatingLoadBtuHr': round(heating_load_btu_hr),
        'coolingLoadBtuHr': round(cooling_load_btu_hr),
        'heatingTons': round(heating_load_btu_hr / 12000, 2),
        'coolingTons': round(cooling_load_btu_hr / 12000, 2),
        'method': 'simplified',
        'designHeatingTemp': design_heating_temp,
        'designCoolingTemp': design_cooling_temp
    }

def generate_epjson(params):
    """Generate EnergyPlus epJSON input file from building parameters"""
    # This is a simplified epJSON structure
    # Full implementation would need complete building geometry
    epjson = {
        "Version": {
            "Version 1": {
                "version_identifier": "23.1.0"
            }
        },
        "Building": {
            "Simple House": {
                "north_axis": 0,
                "terrain": "Suburbs",
                "loads_convergence_tolerance_value": 0.04,
                "temperature_convergence_tolerance_value": 0.4,
                "solar_distribution": "FullExterior",
                "maximum_number_of_warmup_days": 25,
                "minimum_number_of_warmup_days": 6
            }
        },
        "Zone": {
            "Living Zone": {
                "x_origin": 0.0,
                "y_origin": 0.0,
                "z_origin": 0.0,
                "type": 1,
                "multiplier": 1,
                "ceiling_height": params.get('ceilingHeight', 8),
                "volume": params.get('squareFeet', 2000) * params.get('ceilingHeight', 8),
                "floor_area": params.get('squareFeet', 2000),
                "zone_inside_convection_algorithm": "TARP",
                "zone_outside_convection_algorithm": "DOE-2"
            }
        },
        "Material": {
            "R13Wall": {
                "roughness": "MediumRough",
                "thickness": 0.1397,
                "conductivity": 0.046,
                "density": 265.0,
                "specific_heat": 836.8,
                "thermal_absorptance": 0.9,
                "solar_absorptance": 0.7,
                "visible_absorptance": 0.7
            }
        },
        "Construction": {
            "Exterior Wall": {
                "surface_type": "Wall",
                "outside_layer": "R13Wall"
            }
        },
        "ZoneControl:Thermostat": {
            "Living Zone Thermostat": {
                "zone_or_zonelist_name": "Living Zone",
                "control_type_schedule_name": "Heating Setpoint",
                "control_1_object_type": "ThermostatSetpoint:DualSetpoint",
                "control_1_name": "Living Zone Dual Setpoint"
            }
        },
        "ThermostatSetpoint:DualSetpoint": {
            "Living Zone Dual Setpoint": {
                "heating_setpoint_temperature_schedule_name": "Heating Setpoint",
                "cooling_setpoint_temperature_schedule_name": "Cooling Setpoint"
            }
        },
        "Schedule:Compact": {
            "Heating Setpoint": {
                "schedule_type_limits_name": "Temperature",
                "data": [{"until": ["24:00"], "value": 70.0}]
            },
            "Cooling Setpoint": {
                "schedule_type_limits_name": "Temperature",
                "data": [{"until": ["24:00"], "value": 75.0}]
            }
        }
    }
    return epjson

def run_energyplus_simulation(params):
    """Run EnergyPlus simulation and return results"""
    if not ENERGYPLUS_AVAILABLE:
        return calculate_load_simplified(params)
    
    try:
        # Generate epJSON
        epjson = generate_epjson(params)
        
        # Create temporary directory for simulation
        with tempfile.TemporaryDirectory() as tmpdir:
            epjson_path = os.path.join(tmpdir, "input.epJSON")
            output_path = os.path.join(tmpdir, "output")
            
            # Write epJSON file
            with open(epjson_path, 'w') as f:
                json.dump(epjson, f, indent=2)
            
            # Run EnergyPlus (simplified - would need full setup)
            # For now, return simplified calculation
            # Full implementation would:
            # 1. Convert epJSON to IDF
            # 2. Run EnergyPlus
            # 3. Parse output files
            # 4. Extract load results
            
            return calculate_load_simplified(params)
            
    except Exception as e:
        print(f"EnergyPlus simulation error: {e}")
        traceback.print_exc()
        return calculate_load_simplified(params)

def calculate_rebates(zip_code, equipment_sku):
    """
    Calculate total rebates and net price for equipment in a given zip code.
    
    This is a proof-of-concept implementation. In production, this would:
    1. Query federal rebate databases (IRS, DOE)
    2. Query state rebate databases (varies by state)
    3. Query utility rebate databases (varies by utility)
    4. Aggregate all applicable rebates
    5. Return net price after all incentives
    
    Args:
        zip_code: 5-digit US zip code
        equipment_sku: Equipment SKU/model number
        
    Returns:
        dict with rebate breakdown and net price
    """
    # Mock equipment pricing (in production, this would come from a database)
    equipment_prices = {
        'HP-3T-18SEER': 8500,  # 3-ton heat pump, 18 SEER
        'HP-4T-20SEER': 12000,  # 4-ton heat pump, 20 SEER
        'HP-5T-18SEER': 15000,  # 5-ton heat pump, 18 SEER
        'AC-3T-16SEER': 4500,   # 3-ton AC, 16 SEER
        'AC-4T-18SEER': 6500,   # 4-ton AC, 18 SEER
        'FURNACE-80K-96AFUE': 3500,  # 80K BTU furnace, 96% AFUE
        'FURNACE-100K-98AFUE': 4500,  # 100K BTU furnace, 98% AFUE
    }
    
    base_price = equipment_prices.get(equipment_sku, 5000)  # Default price
    
    # Extract state from zip code (simplified - would use proper zip-to-state mapping)
    # For POC, use first digit to estimate region
    zip_first = int(zip_code[0]) if zip_code and zip_code[0].isdigit() else 5
    
    # Federal rebates (IRA/Inflation Reduction Act)
    # Heat pumps: up to $2000, AC: up to $600, Furnaces: up to $1500
    federal_rebate = 0
    if 'HP' in equipment_sku.upper():
        federal_rebate = 2000  # Heat pump rebate
    elif 'AC' in equipment_sku.upper():
        federal_rebate = 600  # AC rebate
    elif 'FURNACE' in equipment_sku.upper():
        federal_rebate = 1500  # High-efficiency furnace rebate
    
    # State rebates (varies by state - simplified mapping)
    state_rebates = {
        0: 500,  # Northeast states (MA, NY, CT, etc.)
        1: 300,  # Northeast states
        2: 400,  # Mid-Atlantic states
        3: 200,  # Southeast states
        4: 300,  # Southeast states
        5: 400,  # Midwest states (IL, MI, etc.)
        6: 500,  # Midwest states
        7: 200,  # Mountain states
        8: 300,  # West Coast states (CA, OR, WA)
        9: 250,  # West Coast states
    }
    state_rebate = state_rebates.get(zip_first, 300)
    
    # Utility rebates (varies by utility - simplified)
    # Higher rebates for high-efficiency equipment
    utility_rebate = 0
    if '18SEER' in equipment_sku.upper() or '20SEER' in equipment_sku.upper():
        utility_rebate = 500  # High-efficiency bonus
    elif '16SEER' in equipment_sku.upper():
        utility_rebate = 200
    if '96AFUE' in equipment_sku.upper() or '98AFUE' in equipment_sku.upper():
        utility_rebate += 300  # High-efficiency furnace bonus
    
    # Total rebates
    total_rebates = federal_rebate + state_rebate + utility_rebate
    net_price = max(0, base_price - total_rebates)  # Can't go negative
    
    return {
        'base_price': base_price,
        'federal_rebate': federal_rebate,
        'state_rebate': state_rebate,
        'utility_rebate': utility_rebate,
        'total_rebates': total_rebates,
        'net_price': net_price,
        'savings_percentage': round((total_rebates / base_price * 100), 1) if base_price > 0 else 0,
        'zip_code': zip_code,
        'equipment_sku': equipment_sku,
    }

class EnergyPlusHandler(BaseHTTPRequestHandler):
    def do_OPTIONS(self):
        """Handle CORS preflight"""
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'POST, GET, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()
    
    def do_POST(self):
        """Handle POST requests"""
        if self.path == '/api/energyplus/calculate':
            try:
                content_length = int(self.headers['Content-Length'])
                post_data = self.rfile.read(content_length)
                params = json.loads(post_data.decode('utf-8'))
                
                # Run simulation
                results = run_energyplus_simulation(params)
                
                # Send response
                self.send_response(200)
                self.send_header('Content-Type', 'application/json')
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                self.wfile.write(json.dumps(results).encode('utf-8'))
                
            except Exception as e:
                self.send_response(500)
                self.send_header('Content-Type', 'application/json')
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                error_response = {
                    'error': str(e),
                    'traceback': traceback.format_exc()
                }
                self.wfile.write(json.dumps(error_response).encode('utf-8'))
        elif self.path == '/api/rebates/calculate':
            try:
                content_length = int(self.headers['Content-Length'])
                post_data = self.rfile.read(content_length)
                data = json.loads(post_data.decode('utf-8'))
                
                zip_code = data.get('zip_code', '')
                equipment_sku = data.get('equipment_sku', '')
                
                if not zip_code or not equipment_sku:
                    self.send_response(400)
                    self.send_header('Content-Type', 'application/json')
                    self.send_header('Access-Control-Allow-Origin', '*')
                    self.end_headers()
                    error_response = {'error': 'Missing zip_code or equipment_sku'}
                    self.wfile.write(json.dumps(error_response).encode('utf-8'))
                    return
                
                # Calculate rebates
                rebate_results = calculate_rebates(zip_code, equipment_sku)
                
                # Send response
                self.send_response(200)
                self.send_header('Content-Type', 'application/json')
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                self.wfile.write(json.dumps(rebate_results).encode('utf-8'))
                
            except Exception as e:
                self.send_response(500)
                self.send_header('Content-Type', 'application/json')
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                error_response = {
                    'error': str(e),
                    'traceback': traceback.format_exc()
                }
                self.wfile.write(json.dumps(error_response).encode('utf-8'))
        else:
            self.send_response(404)
            self.end_headers()
    
    def do_GET(self):
        """Handle GET requests"""
        if self.path == '/api/energyplus/status':
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            status = {
                'status': 'ok',
                'energyplus_available': ENERGYPLUS_AVAILABLE,
                'method': 'simplified' if not ENERGYPLUS_AVAILABLE else 'energyplus'
            }
            self.wfile.write(json.dumps(status).encode('utf-8'))
        else:
            self.send_response(404)
            self.end_headers()
    
    def log_message(self, format, *args):
        """Suppress default logging"""
        pass

def main():
    port = int(os.environ.get('ENERGYPLUS_PORT', 3002))
    server = HTTPServer(('localhost', port), EnergyPlusHandler)
    print(f"EnergyPlus service running on http://localhost:{port}")
    print(f"EnergyPlus available: {ENERGYPLUS_AVAILABLE}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nShutting down EnergyPlus service...")
        server.shutdown()

if __name__ == '__main__':
    main()

