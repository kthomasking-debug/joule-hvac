import React, { useState } from "react";
import { X, Send, Loader } from "lucide-react";
import { shareSettingsWithPi } from "../lib/bridgeApi";

/**
 * Modal for sharing Forecaster settings with Pi Zero 2W e-ink display
 * User enters Pi IP, clicks Share, data is POSTed to bridge server
 */
export function ShareWithPiModal({ isOpen, onClose, onSuccess }) {
  const [piIp, setPiIp] = useState(() => {
    // Try to load previously saved Pi IP
    try {
      return localStorage.getItem("piIpAddress") || "";
    } catch {
      return "";
    }
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  const handleShare = async () => {
    if (!piIp.trim()) {
      setError("Please enter a Pi IP address");
      return;
    }

    setIsLoading(true);
    setError(null);
    setSuccess(false);

    try {
      // Validate IP format (basic check)
      const ipPattern = /^(\d{1,3}\.){3}\d{1,3}$/;
      if (!ipPattern.test(piIp.trim())) {
        throw new Error("Invalid IP address format (e.g., 192.168.1.50)");
      }

      const piUrl = `http://${piIp.trim()}:3002`;
      
      // Test connectivity first
      try {
        const healthRes = await fetch(`${piUrl}/health`, { timeout: 5000 });
        if (!healthRes.ok) {
          throw new Error("Pi bridge not responding (health check failed)");
        }
      } catch (connectErr) {
        throw new Error(
          `Cannot reach Pi at ${piIp}:3002. Is it on and connected? (${connectErr.message})`
        );
      }

      // Share settings
      await shareSettingsWithPi(piUrl);
      
      // Save Pi IP for next time
      try {
        localStorage.setItem("piIpAddress", piIp.trim());
      } catch {
        /* ignore */
      }

      setSuccess(true);
      setError(null);

      // Auto-close after success
      setTimeout(() => {
        onClose();
        if (onSuccess) onSuccess();
      }, 2000);
    } catch (err) {
      console.error("Share error:", err);
      setError(err.message || "Failed to share settings");
      setSuccess(false);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-500 to-blue-600 px-6 py-4 rounded-t-lg flex items-center justify-between">
          <h2 className="text-white font-semibold text-lg">Share with Pi</h2>
          <button
            onClick={onClose}
            disabled={isLoading}
            className="text-white hover:bg-blue-700 p-1 rounded disabled:opacity-50"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          <p className="text-gray-700 text-sm">
            Send your forecaster data to your Pi Zero 2W e-ink display. The costs will sync automatically.
          </p>

          {/* IP Input */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Pi IP Address
            </label>
            <input
              type="text"
              placeholder="e.g., 192.168.1.50"
              value={piIp}
              onChange={(e) => setPiIp(e.target.value)}
              disabled={isLoading}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg font-mono text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100"
            />
            <p className="text-xs text-gray-500 mt-1">
              Find your Pi: run <code className="bg-gray-100 px-1 rounded">hostname -I</code> on the Pi
            </p>
          </div>

          {/* Error */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <p className="text-red-800 text-sm">{error}</p>
            </div>
          )}

          {/* Success */}
          {success && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-3">
              <p className="text-green-800 text-sm font-medium">✓ Settings shared successfully!</p>
              <p className="text-green-700 text-xs mt-1">Your e-ink display will update shortly.</p>
            </div>
          )}

          {/* Info Box */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <p className="text-blue-900 text-xs font-medium mb-1">What gets shared?</p>
            <ul className="text-blue-800 text-xs space-y-1">
              <li>• Weekly heating cost (with/without aux heat)</li>
              <li>• Location and weather forecast</li>
              <li>• Your system settings</li>
            </ul>
          </div>
        </div>

        {/* Actions */}
        <div className="bg-gray-50 px-6 py-4 rounded-b-lg flex gap-3 border-t border-gray-200">
          <button
            onClick={onClose}
            disabled={isLoading}
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-100 disabled:opacity-50 font-medium"
          >
            Cancel
          </button>
          <button
            onClick={handleShare}
            disabled={isLoading || !piIp.trim()}
            className="flex-1 px-4 py-2 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-400 text-white rounded-lg font-medium flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <>
                <Loader size={16} className="animate-spin" />
                Sharing...
              </>
            ) : (
              <>
                <Send size={16} />
                Share
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

export default ShareWithPiModal;
