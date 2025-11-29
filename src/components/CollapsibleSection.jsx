import React, { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";

/**
 * CollapsibleSection - A reusable component for collapsible content sections
 * @param {string} title - The title/header of the section
 * @param {React.ReactNode} children - The content to show/hide
 * @param {boolean} defaultExpanded - Whether the section starts expanded (default: false)
 * @param {string} className - Additional CSS classes for the container
 * @param {React.ReactNode} icon - Optional icon to display next to the title
 */
export default function CollapsibleSection({
  title,
  children,
  defaultExpanded = false,
  className = "",
  icon = null,
}) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  return (
    <div
      className={`bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden mb-6 ${className}`}
    >
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
        aria-expanded={isExpanded}
        aria-label={`${isExpanded ? "Collapse" : "Expand"} ${title}`}
      >
        <div className="flex items-center gap-2">
          {icon && <span className="flex-shrink-0">{icon}</span>}
          <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">
            {title}
          </h3>
        </div>
        {isExpanded ? (
          <ChevronUp className="w-5 h-5 text-gray-500 dark:text-gray-400" />
        ) : (
          <ChevronDown className="w-5 h-5 text-gray-500 dark:text-gray-400" />
        )}
      </button>
      {isExpanded && <div className="p-6">{children}</div>}
    </div>
  );
}
