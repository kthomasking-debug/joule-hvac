import React from 'react';
import { X } from 'lucide-react';

const TermsOfUse = ({ onClose }) => {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-4 flex justify-between items-center">
          <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100">Terms of Use</h2>
          {onClose && (
            <button onClick={onClose} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded">
              <X size={24} className="text-gray-600 dark:text-gray-400" />
            </button>
          )}
        </div>

        <div className="p-6 text-gray-700 dark:text-gray-300 space-y-6 text-sm leading-relaxed">
          <div>
            <h3 className="font-bold text-gray-800 dark:text-gray-100 mb-2">Last Updated: November 11, 2025</h3>
            <p>Welcome to Joule HVAC ("Joule," "we," "us," or "our"). These Terms of Use ("Terms") govern your access to and use of our mobile application and all related services (collectively, the "App"). Please read these terms carefully before using the App.</p>
          </div>

          {/* Acceptance of Terms */}
          <div>
            <h3 className="font-bold text-lg text-gray-800 dark:text-gray-100 mb-2">1. Acceptance of Terms</h3>
            <p>By installing, accessing, and using this App, you agree to be bound by these Terms. If you do not agree to any part of these terms, you must not use the App. We reserve the right to modify these Terms at any time. Your continued use of the App following any such modification constitutes your acceptance of the updated Terms.</p>
          </div>

          {/* Disclaimer of Warranty - CRITICAL */}
          <div className="bg-yellow-50 dark:bg-yellow-900 dark:bg-opacity-20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
            <h3 className="font-bold text-lg text-yellow-900 dark:text-yellow-100 mb-2">2. Disclaimer of Warranty</h3>
            <p className="font-semibold text-yellow-900 dark:text-yellow-100 mb-2">THE APP IS PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTIES OF ANY KIND, EXPRESS OR IMPLIED.</p>
            <p>We make no representation or warranty regarding:</p>
            <ul className="list-disc ml-5 mt-2 space-y-1">
              <li>The accuracy, reliability, or completeness of any calculations or estimates provided by the App</li>
              <li>The suitability of the App for any particular purpose</li>
              <li>That the App will meet your expectations or requirements</li>
              <li>That the App will be uninterrupted, secure, or error-free</li>
            </ul>
            <p className="mt-3"><strong>The App's estimates and calculations are provided for informational and budgeting purposes only.</strong> They are based on mathematical models, assumptions, and historical data that may not account for:
            </p>
            <ul className="list-disc ml-5 mt-2 space-y-1">
              <li>Actual weather variability and seasonal extremes</li>
              <li>Individual usage patterns and thermostat settings</li>
              <li>Building construction quality and air leakage rates</li>
              <li>Equipment degradation over time</li>
              <li>Fluctuations in utility rates and energy markets</li>
              <li>Changes in local, state, or federal energy policies</li>
            </ul>
          </div>

          {/* Limitation of Liability - CRITICAL */}
          <div className="bg-red-50 dark:bg-red-900 dark:bg-opacity-20 border border-red-200 dark:border-red-800 rounded-lg p-4">
            <h3 className="font-bold text-lg text-red-900 dark:text-red-100 mb-2">3. Limitation of Liability</h3>
            <p className="font-semibold text-red-900 dark:text-red-100 mb-2">IN NO EVENT SHALL WE BE LIABLE FOR:</p>
            <ul className="list-disc ml-5 space-y-1">
              <li>Any indirect, incidental, special, consequential, or punitive damages</li>
              <li>Loss of profits, revenue, or anticipated savings</li>
              <li>Loss or corruption of data</li>
              <li>Any financial losses or damages you suffer as a result of using the App or relying on its estimates</li>
            </ul>
            <p className="mt-3"><strong>Even if advised of the possibility of such damages.</strong> This limitation applies to all claims arising out of or related to this App, whether based on warranty, contract, tort, or any other legal theory.</p>
            <p className="mt-3"><strong>Your sole and exclusive remedy for any claim is a refund of the amount you paid for the App (if applicable).</strong></p>
          </div>

          {/* Acceptable Use */}
          <div>
            <h3 className="font-bold text-lg text-gray-800 dark:text-gray-100 mb-2">4. Acceptable Use</h3>
            <p>You agree not to:</p>
            <ul className="list-disc ml-5 mt-2 space-y-1">
              <li>Reverse engineer, decompile, or disassemble the App or its source code</li>
              <li>Use the App for any illegal, fraudulent, or harmful purpose</li>
              <li>Attempt to gain unauthorized access to the App's systems or data</li>
              <li>Copy, modify, or redistribute the App without authorization</li>
              <li>Use the App to infringe on any third-party intellectual property rights</li>
              <li>Interfere with or disrupt the integrity or performance of the App</li>
            </ul>
          </div>

          {/* Intellectual Property */}
          <div>
            <h3 className="font-bold text-lg text-gray-800 dark:text-gray-100 mb-2">5. Intellectual Property Rights</h3>
            <p>The App, including all its content, features, and functionality (including but not limited to all information, software, code, calculations, and design), are owned by us and protected by international copyright, trademark, and other intellectual property laws.</p>
            <p className="mt-2">You are granted a limited, non-exclusive, non-transferable, revocable license to use the App for personal, non-commercial purposes only. You may not sublicense, sell, rent, or lease the App or any portion of it.</p>
          </div>

          {/* User-Provided Data */}
          <div>
            <h3 className="font-bold text-lg text-gray-800 dark:text-gray-100 mb-2">6. User-Provided Data</h3>
            <p>Any data, files, or information you provide to the App ("User Data") is processed on your device. We do not send your User Data to external servers unless explicitly stated otherwise. However, you are solely responsible for maintaining the security of your data and any thermostat files you upload.</p>
            <p className="mt-2">By using the App, you grant us a limited license to use, analyze, and improve the App based on aggregate, anonymized usage patterns (not including personal data).</p>
          </div>

          {/* Third-Party Services */}
          <div>
            <h3 className="font-bold text-lg text-gray-800 dark:text-gray-100 mb-2">7. Third-Party Services</h3>
            <p>The App may integrate with or use third-party services (e.g., weather APIs, analytics). Your use of these services is subject to their respective terms and privacy policies. We are not responsible for the availability, accuracy, or conduct of third-party services.</p>
          </div>

          {/* No Professional Advice */}
          <div>
            <h3 className="font-bold text-lg text-gray-800 dark:text-gray-100 mb-2">8. No Professional Advice</h3>
            <p>The App provides calculations and estimates for educational and informational purposes only. <strong>It does not constitute professional financial, engineering, or energy advice.</strong> Before making significant financial decisions regarding heating, cooling, or energy efficiency improvements, consult with a licensed HVAC contractor, energy auditor, or financial advisor.</p>
          </div>

          {/* Termination */}
          <div>
            <h3 className="font-bold text-lg text-gray-800 dark:text-gray-100 mb-2">9. Termination</h3>
            <p>We may terminate or suspend your access to the App at any time, for any reason, including if you violate these Terms. Termination does not affect your offline use of data already calculated by the App.</p>
          </div>

          {/* Governing Law */}
          <div>
            <h3 className="font-bold text-lg text-gray-800 dark:text-gray-100 mb-2">10. Governing Law and Jurisdiction</h3>
            <p>These Terms are governed by the laws of the United States and applicable state law, without regard to conflict of law principles. Any disputes arising from these Terms or the App are subject to the jurisdiction of the applicable courts.</p>
          </div>

          {/* Contact */}
          <div>
            <h3 className="font-bold text-lg text-gray-800 dark:text-gray-100 mb-2">11. Contact Us</h3>
            <p>If you have questions about these Terms, please contact us through the app's settings or support section.</p>
          </div>

          <div className="border-t border-gray-300 dark:border-gray-600 pt-4 mt-6">
            <p className="text-xs text-gray-600 dark:text-gray-400"><strong>DISCLAIMER:</strong> This document is provided as a template. You should consult with a legal professional to customize these terms for your specific jurisdiction and business needs.</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TermsOfUse;
