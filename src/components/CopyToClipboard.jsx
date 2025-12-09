import React, { useState, memo } from 'react';
import { Copy, Check } from 'lucide-react';

/**
 * Copy to Clipboard Button Component
 * 
 * @param {string} text - The text to copy to clipboard
 * @param {string} label - Optional label for the button (default: "Copy")
 * @param {string} className - Optional additional CSS classes
 * @param {string} successMessage - Optional custom success message
 */
function CopyToClipboard({ text, label = "Copy", className = "", successMessage = "Copied!" }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    if (!text) return;
    
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = text;
      textArea.style.position = 'fixed';
      textArea.style.opacity = '0';
      document.body.appendChild(textArea);
      textArea.select();
      try {
        document.execCommand('copy');
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch (err) {
        console.error('Failed to copy text:', err);
      }
      document.body.removeChild(textArea);
    }
  };

  return (
    <button
      onClick={handleCopy}
      className={`inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
        copied
          ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300'
          : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
      } ${className}`}
      aria-label={copied ? successMessage : `Copy ${label} to clipboard`}
      title={copied ? successMessage : `Copy ${label} to clipboard`}
    >
      {copied ? (
        <>
          <Check size={16} />
          <span>{successMessage}</span>
        </>
      ) : (
        <>
          <Copy size={16} />
          <span>{label}</span>
        </>
      )}
    </button>
  );
}

export default memo(CopyToClipboard);

