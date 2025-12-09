import React from 'react';
import { AlertCircle, X, Wifi } from 'lucide-react';
import { Link } from 'react-router-dom';

/**
 * Demo Mode Banner
 * Shows when app is in demo mode (no Ecobee connection)
 */
export default function DemoModeBanner({ onDismiss, dismissed = false }) {
  if (dismissed) return null;

  return (
    <div className="bg-[#151A21] border-l-4 border-[#1E4CFF] px-4 py-3 mb-6">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 flex-1">
          <AlertCircle className="w-4 h-4 text-[#1E4CFF] flex-shrink-0" />
          <p className="text-sm text-[#A7B0BA]">
            You're viewing demo data. Connect an Ecobee thermostat to enable live control.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            to="/config#joule-bridge"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#1E4CFF] hover:bg-[#1a42e6] text-white text-sm font-medium rounded transition-colors"
          >
            <Wifi className="w-3.5 h-3.5" />
            Connect Ecobee
          </Link>
          {onDismiss && (
            <button
              onClick={onDismiss}
              className="text-[#7C8894] hover:text-[#A7B0BA] text-sm font-medium transition-colors"
            >
              Dismiss
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

