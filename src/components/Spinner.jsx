import React from 'react';

// Minimal spinner used across the app for async operations
export default function Spinner({ size = 24, className = '' }) {
    const dims = typeof size === 'number' ? `${size}px` : size;
    return (
        <div
            role="status"
            aria-live="polite"
            className={`inline-flex items-center justify-center ${className}`}
            data-testid="spinner"
        >
            <svg
                width={dims}
                height={dims}
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                className="animate-spin text-gray-700 dark:text-gray-100"
            >
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeOpacity="0.15" strokeWidth="4"></circle>
                <path
                    d="M22 12a10 10 0 00-10-10"
                    stroke="currentColor"
                    strokeWidth="4"
                    strokeLinecap="round"
                ></path>
            </svg>
            <span className="sr-only">Loading</span>
        </div>
    );
}
