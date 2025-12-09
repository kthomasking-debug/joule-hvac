import React, { useState, useEffect } from 'react';
import { AlertCircle, Info } from 'lucide-react';
import IconTooltip from './IconTooltip';

/**
 * ValidatedInput Component
 * Provides real-time validation with inline error messages and range indicators
 * 
 * @param {string} type - Input type (number, text, etc.)
 * @param {string} label - Label for the input
 * @param {any} value - Current value
 * @param {Function} onChange - Change handler
 * @param {Object} validation - Validation rules
 * @param {string} tooltip - Tooltip text
 * @param {string} rangeText - Range indicator text (e.g., "Typical: 1500-2500")
 * @param {string} className - Additional CSS classes
 * @param {Object} inputProps - Additional input props
 */
export default function ValidatedInput({
  type = 'text',
  label,
  value,
  onChange,
  validation = {},
  tooltip = null,
  rangeText = null,
  className = '',
  inputProps = {},
  ...props
}) {
  const [error, setError] = useState(null);
  const [touched, setTouched] = useState(false);

  const {
    min,
    max,
    required = false,
    pattern = null,
    customValidator = null,
    errorMessage = null,
  } = validation;

  // Validate on value change
  useEffect(() => {
    if (!touched) return;

    let newError = null;

    // Required validation
    if (required && (value === '' || value === null || value === undefined)) {
      newError = errorMessage || `${label} is required`;
    }
    // Min validation
    else if (min !== undefined && type === 'number' && Number(value) < min) {
      newError = errorMessage || `${label} must be at least ${min}`;
    }
    // Max validation
    else if (max !== undefined && type === 'number' && Number(value) > max) {
      newError = errorMessage || `${label} must be at most ${max}`;
    }
    // Pattern validation
    else if (pattern && typeof value === 'string' && !pattern.test(value)) {
      newError = errorMessage || `${label} format is invalid`;
    }
    // Custom validator
    else if (customValidator) {
      const customError = customValidator(value);
      if (customError) {
        newError = customError;
      }
    }

    setError(newError);
  }, [value, touched, min, max, required, pattern, customValidator, errorMessage, label, type]);

  const handleBlur = () => {
    setTouched(true);
    if (inputProps.onBlur) {
      inputProps.onBlur();
    }
  };

  const handleChange = (e) => {
    setTouched(true);
    onChange(e);
  };

  const inputClasses = `w-full p-3 border-2 rounded-lg bg-white dark:bg-gray-800 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all duration-300 shadow-sm ${
    error && touched
      ? 'border-red-500 focus:border-red-500'
      : 'border-gray-300 dark:border-gray-600 hover:border-blue-400 dark:hover:border-blue-500 focus:border-blue-500'
  } ${className}`;

  return (
    <div className="space-y-1">
      <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300">
        <div className="flex items-center gap-2">
          {label}
          {tooltip && (
            <IconTooltip
              icon={<Info size={14} className="text-gray-400" />}
              tooltip={tooltip}
              position="top"
            />
          )}
        </div>
        {rangeText && (
          <span className="text-xs font-normal text-gray-500 dark:text-gray-400 ml-0">
            ({rangeText})
          </span>
        )}
      </label>
      
      <input
        type={type}
        value={value ?? ''}
        onChange={handleChange}
        onBlur={handleBlur}
        className={inputClasses}
        aria-invalid={error && touched ? 'true' : 'false'}
        aria-describedby={error && touched ? `${label}-error` : undefined}
        {...inputProps}
        {...props}
      />
      
      {error && touched && (
        <div
          id={`${label}-error`}
          className="flex items-center gap-1.5 text-sm text-red-600 dark:text-red-400"
          role="alert"
        >
          <AlertCircle size={14} />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}






