import React, { useState } from 'react';
import { HelpCircle } from 'lucide-react';

/**
 * Icon Tooltip Component
 * Wraps an icon with a tooltip explaining its function
 * 
 * @param {ReactNode} icon - The icon component to wrap
 * @param {string} tooltip - The tooltip text to display
 * @param {string} position - Tooltip position: 'top', 'bottom', 'left', 'right'
 */
export default function IconTooltip({ icon, tooltip, position = 'top', className = '' }) {
  const [showTooltip, setShowTooltip] = useState(false);

  if (!tooltip) {
    return icon;
  }

  const positionClasses = {
    top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
    bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
    left: 'right-full top-1/2 -translate-y-1/2 mr-2',
    right: 'left-full top-1/2 -translate-y-1/2 ml-2',
  };

  return (
    <div 
      className={`relative inline-block ${className}`}
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
      onFocus={() => setShowTooltip(true)}
      onBlur={() => setShowTooltip(false)}
    >
      {icon}
      {showTooltip && (
        <div
          className={`absolute z-50 px-3 py-2 text-sm text-white bg-gray-900 dark:bg-gray-800 rounded-lg shadow-lg whitespace-nowrap pointer-events-none ${positionClasses[position]}`}
          role="tooltip"
          aria-label={tooltip}
        >
          {tooltip}
          <div className={`absolute ${
            position === 'top' ? 'top-full left-1/2 -translate-x-1/2 border-t-gray-900 dark:border-t-gray-800' :
            position === 'bottom' ? 'bottom-full left-1/2 -translate-x-1/2 border-b-gray-900 dark:border-b-gray-800' :
            position === 'left' ? 'left-full top-1/2 -translate-y-1/2 border-l-gray-900 dark:border-l-gray-800' :
            'right-full top-1/2 -translate-y-1/2 border-r-gray-900 dark:border-r-gray-800'
          } border-4 border-transparent`} />
        </div>
      )}
    </div>
  );
}

/**
 * Helper to add tooltip to any icon
 * Usage: <IconWithTooltip icon={<Home />} tooltip="Navigate to home page" />
 */
export function IconWithTooltip({ icon, tooltip, ...props }) {
  return <IconTooltip icon={icon} tooltip={tooltip} {...props} />;
}






