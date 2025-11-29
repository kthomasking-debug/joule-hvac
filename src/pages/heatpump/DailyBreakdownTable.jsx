import React, { useState, useEffect } from 'react';
import { ChevronUp, ChevronDown, HelpCircle } from 'lucide-react';

const DailyBreakdownTable = ({ summary = [], indoorTemp = 70, viewMode = 'withAux' }) => {
    const [isMobile, setIsMobile] = useState(false);
    const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });
    const [tooltip, setTooltip] = useState(null);

    useEffect(() => {
        const checkMobile = () => setIsMobile(window.innerWidth < 640);
        checkMobile();
        window.addEventListener('resize', checkMobile);
        return () => window.removeEventListener('resize', checkMobile);
    }, []);

    const tooltips = {
        indoorTemp: 'The lowest indoor temperature achieved during the day with your current system',
        avgRH: 'Average relative humidity throughout the day',
        energyHP: 'Energy consumed by the heat pump compressor only',
        energyAux: 'Energy consumed by auxiliary/backup electric resistance heat',
        cost: 'Total daily cost based on your electricity rate schedule'
    };

    const headers = {
        indoorTemp: viewMode === 'withAux' ? 'Min Indoor (With Aux)' : 'Worst Indoor (No Aux)',
        cost: viewMode === 'withAux' ? 'Daily Cost (with Aux)' : 'Daily Cost (HP Only)'
    };

    // Sorting function
    const sortData = (data, key) => {
        if (!key) return data;
        const sorted = [...data].sort((a, b) => {
            let aVal, bVal;
            switch (key) {
                case 'day': {
                    // Parse date from string like 'Fri, 11/14'
                    const parseDay = (str) => {
                        const match = str.match(/(\d{1,2})\/(\d{1,2})/);
                        if (!match) return 0;
                        const month = parseInt(match[1], 10);
                        const day = parseInt(match[2], 10);
                        return month * 100 + day;
                    };
                    aVal = parseDay(a.day);
                    bVal = parseDay(b.day);
                    return sortConfig.direction === 'asc' ? aVal - bVal : bVal - aVal;
                }
                case 'tempRange':
                    aVal = (a.lowTemp + a.highTemp) / 2;
                    bVal = (b.lowTemp + b.highTemp) / 2;
                    break;
                case 'indoorTemp':
                    aVal = viewMode === 'withAux' ? (a.minIndoorTemp ?? indoorTemp) : (a.minNoAuxIndoorTemp ?? indoorTemp);
                    bVal = viewMode === 'withAux' ? (b.minIndoorTemp ?? indoorTemp) : (b.minNoAuxIndoorTemp ?? indoorTemp);
                    break;
                case 'avgHumidity':
                    aVal = a.avgHumidity;
                    bVal = b.avgHumidity;
                    break;
                case 'energy':
                    aVal = a.energy;
                    bVal = b.energy;
                    break;
                case 'auxEnergy':
                    aVal = a.auxEnergy;
                    bVal = b.auxEnergy;
                    break;
                case 'cost':
                    aVal = viewMode === 'withAux' ? (a.costWithAux ?? a.cost) : a.cost;
                    bVal = viewMode === 'withAux' ? (b.costWithAux ?? b.cost) : b.cost;
                    break;
                default:
                    return 0;
            }

            return sortConfig.direction === 'asc' ? aVal - bVal : bVal - aVal;
        });

        return sorted;
    };

    const handleSort = (key) => {
        setSortConfig(current => ({
            key,
            direction: current.key === key && current.direction === 'asc' ? 'desc' : 'asc'
        }));
    };

    const SortIcon = ({ column }) => {
        if (sortConfig.key !== column) return <ChevronUp size={14} className="opacity-30" />;
        return sortConfig.direction === 'asc' ?
            <ChevronUp size={14} className="text-blue-600" /> :
            <ChevronDown size={14} className="text-blue-600" />;
    };

    const InlineBar = ({ value, maxValue, color = 'blue' }) => {
        const percentage = Math.min((value / maxValue) * 100, 100);
        const colorClasses = {
            blue: 'bg-blue-500',
            orange: 'bg-orange-500',
            green: 'bg-green-500'
        };

        return (
            <div className="flex items-center gap-2">
                <div className="flex-grow bg-gray-200 dark:bg-gray-600 rounded-full h-2 max-w-[100px]">
                    <div
                        className={`${colorClasses[color]} h-2 rounded-full transition-all`}
                        style={{ width: `${percentage}%` }}
                    ></div>
                </div>
                <span className="text-sm font-semibold min-w-[60px] text-gray-900 dark:text-gray-100">{value.toFixed(1)} kWh</span>
            </div>
        );
    };

    const sortedSummary = sortData(summary, sortConfig.key);
    const maxEnergy = Math.max(...summary.map(d => d.energy), 1);
    const maxAuxEnergy = Math.max(...summary.map(d => d.auxEnergy), 1);

    // Calculate min and max cost for heat map
    const costs = summary.map(day => viewMode === 'withAux' ? (day.costWithAux ?? day.cost) : day.cost);
    const minCost = Math.min(...costs);
    const maxCost = Math.max(...costs);

    // Get heat map color based on cost value
    const getHeatMapColor = (cost) => {
        if (maxCost === minCost) return 'rgba(34, 197, 94, 0.1)'; // All same, light green
        const ratio = (cost - minCost) / (maxCost - minCost);
        // Gradient from light green (low cost) to light red (high cost)
        const r = Math.round(34 + (239 - 34) * ratio);
        const g = Math.round(197 - (197 - 68) * ratio);
        const b = Math.round(94 - (94 - 68) * ratio);
        return `rgba(${r}, ${g}, ${b}, ${0.15 + ratio * 0.25})`;
    };

    // Mobile card-based layout
    if (isMobile) {
        return (
            <div className="daily-breakdown-mobile space-y-3">
                {sortedSummary.map((day) => {
                    const displayIndoor = viewMode === 'withAux' ? (day.minIndoorTemp ?? indoorTemp) : (day.minNoAuxIndoorTemp ?? indoorTemp);
                    const isBelowSetpoint = displayIndoor < indoorTemp;
                    const displayCost = viewMode === 'withAux' ? (day.costWithAux ?? day.cost) : day.cost;

                    return (
                        <div key={day.day} className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
                            <div className="flex items-center justify-between mb-3 pb-2 border-b dark:border-gray-700">
                                <span className="text-lg font-bold text-gray-900 dark:text-gray-100">{day.day}</span>
                                <span className="text-xl font-bold text-green-600 dark:text-green-400">${displayCost.toFixed(2)}</span>
                            </div>
                            <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <span className="text-sm text-gray-600 dark:text-gray-400">Temp Range</span>
                                    <div className="flex items-center gap-2">
                                        <div className="bg-gradient-to-r from-blue-400 to-red-400 rounded-full h-2 w-12"></div>
                                        <span className="text-sm font-medium text-gray-900 dark:text-gray-100">{`${day.lowTemp.toFixed(0)} - ${day.highTemp.toFixed(0)}°F`}</span>
                                    </div>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span className="text-sm text-gray-600 dark:text-gray-400">Indoor Temp</span>
                                    <span className={`text-sm font-bold ${isBelowSetpoint ? 'text-red-600 dark:text-red-400' : 'text-gray-800 dark:text-gray-200'}`}>{displayIndoor.toFixed(1)}°F</span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span className="text-sm text-gray-600 dark:text-gray-400">Avg Humidity</span>
                                    <span className="text-sm font-medium text-gray-900 dark:text-gray-100">{day.avgHumidity.toFixed(0)}%</span>
                                </div>
                                <div className="pt-2 border-t dark:border-gray-700">
                                    <div className="flex items-center justify-between mb-1">
                                        <span className="text-sm text-gray-600 dark:text-gray-400">HP Energy</span>
                                    </div>
                                    <InlineBar value={day.energy} maxValue={maxEnergy} color="blue" />
                                </div>
                                <div>
                                    <div className="flex items-center justify-between mb-1">
                                        <span className="text-sm text-gray-600 dark:text-gray-400">Aux Energy</span>
                                    </div>
                                    <InlineBar value={day.auxEnergy} maxValue={maxAuxEnergy} color="orange" />
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        );
    }

    // Desktop table layout
    return (
        <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
                <thead>
                    <tr className="bg-gradient-to-r from-gray-100 to-gray-50 dark:from-gray-700 dark:to-gray-800 border-b-2 border-gray-300 dark:border-gray-600">
                        <th
                            className="p-3 font-semibold text-gray-900 dark:text-gray-100 cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                            onClick={() => handleSort('day')}
                        >
                            <div className="flex items-center gap-1">
                                Day
                                <SortIcon column="day" />
                            </div>
                        </th>
                        <th
                            className="p-3 font-semibold text-gray-900 dark:text-gray-100 cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                            onClick={() => handleSort('tempRange')}
                        >
                            <div className="flex items-center gap-1">
                                Temp Range
                                <SortIcon column="tempRange" />
                            </div>
                        </th>
                        <th
                            className="p-3 font-semibold text-gray-900 dark:text-gray-100 cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors group relative"
                            onClick={() => handleSort('indoorTemp')}
                        >
                            <div className="flex items-center gap-1">
                                {headers.indoorTemp}
                                <SortIcon column="indoorTemp" />
                                <HelpCircle
                                    size={14}
                                    className="text-gray-400 hover:text-blue-600 cursor-help"
                                    onMouseEnter={() => setTooltip('indoorTemp')}
                                    onMouseLeave={() => setTooltip(null)}
                                />
                            </div>
                            {tooltip === 'indoorTemp' && (
                                <div className="absolute z-10 bg-gray-900 text-white text-xs rounded p-2 shadow-lg w-48 top-full left-0 mt-1">
                                    {tooltips.indoorTemp}
                                </div>
                            )}
                        </th>
                        <th
                            className="p-3 font-semibold text-gray-900 dark:text-gray-100 cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors group relative"
                            onClick={() => handleSort('avgHumidity')}
                        >
                            <div className="flex items-center gap-1">
                                Avg RH
                                <SortIcon column="avgHumidity" />
                                <HelpCircle
                                    size={14}
                                    className="text-gray-400 hover:text-blue-600 cursor-help"
                                    onMouseEnter={() => setTooltip('avgRH')}
                                    onMouseLeave={() => setTooltip(null)}
                                />
                            </div>
                            {tooltip === 'avgRH' && (
                                <div className="absolute z-10 bg-gray-900 text-white text-xs rounded p-2 shadow-lg w-48 top-full left-0 mt-1">
                                    {tooltips.avgRH}
                                </div>
                            )}
                        </th>
                        <th
                            className="p-3 font-semibold text-gray-900 dark:text-gray-100 cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors group relative"
                            onClick={() => handleSort('energy')}
                        >
                            <div className="flex items-center gap-1">
                                Energy Use (HP)
                                <SortIcon column="energy" />
                                <HelpCircle
                                    size={14}
                                    className="text-gray-400 hover:text-blue-600 cursor-help"
                                    onMouseEnter={() => setTooltip('energyHP')}
                                    onMouseLeave={() => setTooltip(null)}
                                />
                            </div>
                            {tooltip === 'energyHP' && (
                                <div className="absolute z-10 bg-gray-900 text-white text-xs rounded p-2 shadow-lg w-48 top-full left-0 mt-1">
                                    {tooltips.energyHP}
                                </div>
                            )}
                        </th>
                        <th
                            className="p-3 font-semibold text-gray-900 dark:text-gray-100 cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors group relative"
                            onClick={() => handleSort('auxEnergy')}
                        >
                            <div className="flex items-center gap-1">
                                Energy Use (Aux)
                                <SortIcon column="auxEnergy" />
                                <HelpCircle
                                    size={14}
                                    className="text-gray-400 hover:text-blue-600 cursor-help"
                                    onMouseEnter={() => setTooltip('energyAux')}
                                    onMouseLeave={() => setTooltip(null)}
                                />
                            </div>
                            {tooltip === 'energyAux' && (
                                <div className="absolute z-10 bg-gray-900 text-white text-xs rounded p-2 shadow-lg w-48 top-full left-0 mt-1">
                                    {tooltips.energyAux}
                                </div>
                            )}
                        </th>
                        <th
                            className="p-3 font-semibold text-gray-900 dark:text-gray-100 cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors group relative"
                            onClick={() => handleSort('cost')}
                        >
                            <div className="flex items-center gap-1">
                                {headers.cost}
                                <SortIcon column="cost" />
                                <HelpCircle
                                    size={14}
                                    className="text-gray-400 hover:text-blue-600 cursor-help"
                                    onMouseEnter={() => setTooltip('cost')}
                                    onMouseLeave={() => setTooltip(null)}
                                />
                            </div>
                            {tooltip === 'cost' && (
                                <div className="absolute z-10 bg-gray-900 text-white text-xs rounded p-2 shadow-lg w-48 top-full left-0 mt-1">
                                    {tooltips.cost}
                                </div>
                            )}
                        </th>
                    </tr>
                </thead>
                <tbody>
                    {sortedSummary.map((day) => {
                        const displayIndoor = viewMode === 'withAux' ? (day.minIndoorTemp ?? indoorTemp) : (day.minNoAuxIndoorTemp ?? indoorTemp);
                        const isBelowSetpoint = displayIndoor < indoorTemp;
                        const displayCost = viewMode === 'withAux' ? (day.costWithAux ?? day.cost) : day.cost;

                        return (
                            <tr
                                key={day.day}
                                className={`even:bg-white odd:bg-gray-50 dark:even:bg-gray-800 dark:odd:bg-gray-700 hover:bg-blue-50 dark:hover:bg-blue-900 transition-colors`}
                            >
                                <td className="p-3 font-semibold text-gray-900 dark:text-gray-100">{day.day}</td>
                                <td className="p-3">
                                    <div className="flex items-center gap-2">
                                        <div className="bg-gradient-to-r from-blue-400 to-red-400 rounded-full h-2 w-16"></div>
                                        <span className="text-sm text-gray-900 dark:text-gray-100">{`${day.lowTemp.toFixed(0)} - ${day.highTemp.toFixed(0)}°F`}</span>
                                    </div>
                                </td>
                                <td className={`p-3 font-bold ${isBelowSetpoint ? 'text-red-600 dark:text-red-400' : 'text-gray-800 dark:text-gray-200'}`}>{displayIndoor.toFixed(1)}°F</td>
                                <td className="p-3 text-gray-900 dark:text-gray-100">{day.avgHumidity.toFixed(0)}%</td>
                                <td className="p-3">
                                    <InlineBar value={day.energy} maxValue={maxEnergy} color="blue" />
                                </td>
                                <td className="p-3">
                                    <InlineBar value={day.auxEnergy} maxValue={maxAuxEnergy} color="orange" />
                                </td>
                                <td
                                    className="p-3 transition-colors"
                                    style={{ backgroundColor: getHeatMapColor(displayCost) }}
                                >
                                    <span className="text-lg font-bold text-green-700 dark:text-green-400">${displayCost.toFixed(2)}</span>
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
};

export default DailyBreakdownTable;
