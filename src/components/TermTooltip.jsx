import React from 'react';
import IconTooltip from './IconTooltip';
import { HelpCircle } from 'lucide-react';

/**
 * Term Tooltip Component
 * Displays a tooltip explaining technical terms
 * 
 * @param {string} term - The technical term (e.g., 'HSPF', 'SEER', 'COP')
 * @param {string} explanation - The explanation text
 * @param {string} className - Additional CSS classes
 */
export default function TermTooltip({ term, explanation, className = '' }) {
  const termExplanations = {
    'HSPF': 'Heating Seasonal Performance Factor - measures heat pump heating efficiency. Higher is better. Typical range: 8-13.',
    'SEER': 'Seasonal Energy Efficiency Ratio - measures air conditioning efficiency. Higher is better. Typical range: 13-25.',
    'COP': 'Coefficient of Performance - ratio of heat output to energy input. Higher is better. Typical range: 2.5-5.0.',
    'BTU': 'British Thermal Unit - unit of energy. 1 BTU = amount of energy needed to heat 1 pound of water by 1°F.',
    'BTU/hr': 'British Thermal Units per hour - rate of heat transfer.',
    'BTU/hr/°F': 'Heat loss factor - building heat loss per hour per degree Fahrenheit temperature difference.',
    'Balance Point': 'Outdoor temperature where heat pump output equals building heat loss. Below this, auxiliary heat is needed.',
    'Heat Loss Factor': 'Building envelope performance metric. Lower values indicate better insulation and air sealing.',
    'Thermal Mass': 'Ability of materials to store heat. Higher thermal mass = slower temperature changes.',
    'Defrost Cycle': 'Heat pump operation that melts ice on outdoor coil. Temporarily reduces efficiency.',
    'Auxiliary Heat': 'Backup heating (usually electric resistance) used when heat pump cannot meet demand.',
    'Runtime': 'Time the heating/cooling system is actively running.',
    'Capacity Factor': 'Ratio of actual heat output to rated capacity at given conditions.',
    'Efficiency Percentile': 'How your building efficiency compares to typical U.S. homes. Higher = more efficient.',
  };

  const explanationText = explanation || termExplanations[term] || `Explanation for ${term}`;

  return (
    <IconTooltip
      icon={<HelpCircle size={14} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300" />}
      tooltip={explanationText}
      position="top"
      className={className}
    />
  );
}






