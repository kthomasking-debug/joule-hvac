import React from "react";

export function Switch({ checked, onChange, className = "", ...props }) {
  return (
    <label className={"inline-flex items-center cursor-pointer " + className}>
      <input
        type="checkbox"
        checked={checked}
        onChange={e => onChange(e.target.checked)}
        className="sr-only"
        {...props}
      />
      <span className="w-10 h-6 bg-gray-300 dark:bg-gray-700 rounded-full shadow-inner flex items-center transition-all">
        <span
          className={
            "inline-block w-5 h-5 bg-white dark:bg-gray-900 rounded-full shadow transform transition-all " +
            (checked ? "translate-x-4" : "")
          }
        />
      </span>
    </label>
  );
}
