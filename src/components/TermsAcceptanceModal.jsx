import React, { useState } from 'react';
import { AlertCircle, ChevronDown } from 'lucide-react';
import TermsOfUse from '../legal/TermsOfUse';
import PrivacyPolicy from '../legal/PrivacyPolicy';

const TermsAcceptanceModal = ({ onAccept }) => {
  const [accepted, setAccepted] = useState(false);
  const [showTerms, setShowTerms] = useState(false);
  const [showPrivacy, setShowPrivacy] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const handleAccept = () => {
    if (accepted) {
      onAccept();
    }
  };

  return (
    <>
      <div className="fixed inset-0 bg-black bg-opacity-60 flex items-end z-40">
        <div className="bg-white dark:bg-gray-800 w-full max-h-[80vh] overflow-y-auto rounded-t-2xl shadow-2xl">
          {/* Header */}
          <div className="sticky top-0 bg-gradient-to-r from-blue-600 to-blue-700 dark:from-blue-700 dark:to-blue-800 text-white p-6">
            <div className="flex items-start gap-3">
              <AlertCircle size={24} className="flex-shrink-0 mt-1" />
              <div>
                <h2 className="text-2xl font-bold">Welcome to Joule</h2>
                <p className="text-blue-100 text-sm mt-1">Your Home Energy, Measured</p>
                <p className="text-blue-100 text-sm mt-1">Please review and accept our terms before continuing</p>
              </div>
            </div>
          </div>

          <div className="p-6 space-y-6">
            {/* Key Points Summary */}
            <div className="bg-blue-50 dark:bg-blue-900 dark:bg-opacity-20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
              <h3 className="font-bold text-gray-800 dark:text-gray-100 mb-3 flex items-center gap-2">
                <ChevronDown size={18} />
                What You Need to Know
              </h3>
              <ul className="space-y-2 text-sm text-gray-700 dark:text-gray-300">
                <li className="flex gap-2">
                  <span className="text-blue-600 dark:text-blue-400 font-bold">•</span>
                  <span><strong>Estimates Only:</strong> Our calculations are for budgeting purposes. Actual costs may vary due to weather, usage patterns, and rate changes.</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-blue-600 dark:text-blue-400 font-bold">•</span>
                  <span><strong>No Warranties:</strong> The app is provided "as is" without guarantees of accuracy. We are not liable for financial losses from using our estimates.</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-blue-600 dark:text-blue-400 font-bold">•</span>
                  <span><strong>Your Data:</strong> Location and thermostat data are processed on your device. We don't share your personal data with third parties.</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-blue-600 dark:text-blue-400 font-bold">•</span>
                  <span><strong>Not Professional Advice:</strong> Consult an HVAC contractor or energy auditor before making major decisions.</span>
                </li>
              </ul>
            </div>

            {/* Expandable Legal Text */}
            <div className="border border-gray-300 dark:border-gray-600 rounded-lg overflow-hidden">
              <button
                onClick={() => setExpanded(!expanded)}
                className="w-full p-4 bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 flex items-center justify-between font-semibold text-gray-800 dark:text-gray-100"
              >
                <span>Full Legal Text (Optional Reading)</span>
                <ChevronDown
                  size={20}
                  className={`transition-transform ${expanded ? 'rotate-180' : ''}`}
                />
              </button>
              {expanded && (
                <div className="p-4 bg-white dark:bg-gray-800 border-t border-gray-300 dark:border-gray-600 text-sm text-gray-700 dark:text-gray-300 space-y-4">
                  <div>
                    <h4 className="font-semibold text-gray-800 dark:text-gray-100 mb-2">Terms of Use Summary:</h4>
                    <p className="text-xs leading-relaxed">The app and all calculations are provided "as is" without warranty. We disclaim all warranties of accuracy, reliability, or fitness for a particular purpose. Actual energy costs depend on weather, usage, equipment efficiency, and utility rates—factors we cannot predict. We are not liable for any financial losses, damages, or unmet expectations. This app is for informational purposes only and does not constitute professional advice. You use the app at your own risk.</p>
                  </div>
                  <div>
                    <h4 className="font-semibold text-gray-800 dark:text-gray-100 mb-2">Privacy Summary:</h4>
                    <p className="text-xs leading-relaxed">All data you enter (location, thermostat files, calculator inputs) is processed on your device and not uploaded to our servers. We use third-party weather services to fetch forecasts—your location is shared only for this purpose. We collect anonymous usage analytics to improve the app. We do not sell or share your personal data. You can delete all data by uninstalling the app. GDPR and CCPA rights apply to EU/CA residents.</p>
                  </div>
                </div>
              )}
            </div>

            {/* Document Links */}
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setShowTerms(true)}
                className="p-3 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 font-semibold text-gray-800 dark:text-gray-100 text-sm transition-colors"
              >
                📋 Read Terms of Use
              </button>
              <button
                onClick={() => setShowPrivacy(true)}
                className="p-3 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 font-semibold text-gray-800 dark:text-gray-100 text-sm transition-colors"
              >
                🔒 Read Privacy Policy
              </button>
            </div>

            {/* Checkbox */}
            <div className="bg-yellow-50 dark:bg-yellow-900 dark:bg-opacity-10 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={accepted}
                  onChange={(e) => setAccepted(e.target.checked)}
                  className="mt-1 w-5 h-5 accent-blue-600 cursor-pointer"
                />
                <span className="text-sm text-gray-800 dark:text-gray-200">
                  I have read and understand the Terms of Use and Privacy Policy. I acknowledge that the app's estimates are for informational purposes only and that I use the app at my own risk.
                </span>
              </label>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3">
              <button
                onClick={handleAccept}
                disabled={!accepted}
                className={`flex-1 py-3 rounded-lg font-semibold transition-all ${
                  accepted
                    ? 'bg-blue-600 hover:bg-blue-700 text-white cursor-pointer'
                    : 'bg-gray-300 dark:bg-gray-600 text-gray-500 dark:text-gray-400 cursor-not-allowed'
                }`}
              >
                ✓ Accept & Continue
              </button>
            </div>

            <p className="text-xs text-center text-gray-600 dark:text-gray-400">
              By clicking "Accept", you agree to be bound by these terms. You can review them anytime in Settings.
            </p>
          </div>
        </div>
      </div>

      {/* Modal windows for full documents */}
      {showTerms && <TermsOfUse onClose={() => setShowTerms(false)} />}
      {showPrivacy && <PrivacyPolicy onClose={() => setShowPrivacy(false)} />}
    </>
  );
};

export default TermsAcceptanceModal;
