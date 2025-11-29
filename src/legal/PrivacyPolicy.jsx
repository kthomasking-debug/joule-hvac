import React from 'react';
import { X } from 'lucide-react';

const PrivacyPolicy = ({ onClose }) => {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-4 flex justify-between items-center">
          <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100">Privacy Policy</h2>
          {onClose && (
            <button onClick={onClose} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded">
              <X size={24} className="text-gray-600 dark:text-gray-400" />
            </button>
          )}
        </div>

        <div className="p-6 text-gray-700 dark:text-gray-300 space-y-6 text-sm leading-relaxed">
          <div>
            <h3 className="font-bold text-gray-800 dark:text-gray-100 mb-2">Last Updated: November 11, 2025</h3>
            <p>At Joule HVAC ("Joule," "we," "us," "our," or "Company"), we are committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our mobile application (the "App").</p>
          </div>

          {/* Information We Collect */}
          <div>
            <h3 className="font-bold text-lg text-gray-800 dark:text-gray-100 mb-2">1. Information We Collect</h3>
            
            <div className="ml-4 space-y-3">
              <div>
                <h4 className="font-semibold text-gray-800 dark:text-gray-100 mb-1">A. Location Data</h4>
                <p><strong>What:</strong> City, state, and geographic coordinates you provide to the App</p>
                <p><strong>Purpose:</strong> To fetch accurate 7-day weather forecasts and calculate degree-days for your specific location</p>
                <p><strong>Storage:</strong> Location data is stored only on your device. We do not upload it to our servers.</p>
              </div>

              <div>
                <h4 className="font-semibold text-gray-800 dark:text-gray-100 mb-1">B. Thermostat Data (Optional)</h4>
                <p><strong>What:</strong> CSV files containing historical thermostat runtime, temperature setpoints, indoor/outdoor temperatures, and humidity readings that you choose to upload</p>
                <p><strong>Purpose:</strong> To calculate a personalized Heat Loss Factor by correlating your actual runtime history with outdoor temperatures</p>
                <p><strong>Storage:</strong> Thermostat files are processed on your device. We do not upload them to external servers or store them on our systems unless you explicitly export results.</p>
              </div>

              <div>
                <h4 className="font-semibold text-gray-800 dark:text-gray-100 mb-1">C. Calculator Inputs</h4>
                <p><strong>What:</strong> Values you enter such as square footage, insulation level, home shape, ceiling height, indoor temperature setpoint, utility cost, and heat pump specifications</p>
                <p><strong>Purpose:</strong> To perform calculations and generate forecasts</p>
                <p><strong>Storage:</strong> Stored on your device in local app storage. Not transmitted to external servers.</p>
              </div>

              <div>
                <h4 className="font-semibold text-gray-800 dark:text-gray-100 mb-1">D. Usage Analytics (Optional)</h4>
                <p><strong>What:</strong> Anonymous, aggregate data about app feature usage, screen views, and error rates</p>
                <p><strong>Purpose:</strong> To understand how users interact with the App and identify areas for improvement</p>
                <p><strong>Data:</strong> Does not include personal identifiers, location, or calculation inputs. We collect only timestamps and feature names.</p>
                <p><strong>Tools:</strong> We use Google Analytics or similar service (see Section 4)</p>
              </div>

              <div>
                <h4 className="font-semibold text-gray-800 dark:text-gray-100 mb-1">E. Device Information</h4>
                <p><strong>What:</strong> Device type, operating system version, app version, and language settings</p>
                <p><strong>Purpose:</strong> To ensure app compatibility and provide optimal user experience</p>
              </div>
            </div>
          </div>

          {/* How We Use Your Information */}
          <div>
            <h3 className="font-bold text-lg text-gray-800 dark:text-gray-100 mb-2">2. How We Use Your Information</h3>
            <ul className="list-disc ml-5 space-y-2">
              <li><strong>To Provide the App:</strong> Process your inputs, fetch weather data, and perform calculations</li>
              <li><strong>To Improve the App:</strong> Analyze usage patterns and error logs to identify bugs and enhance features</li>
              <li><strong>To Respond to Support Requests:</strong> If you contact us for help</li>
              <li><strong>To Comply with Legal Obligations:</strong> If required by law, regulation, or legal process</li>
            </ul>
          </div>

          {/* Data Storage and Security */}
          <div>
            <h3 className="font-bold text-lg text-gray-800 dark:text-gray-100 mb-2">3. Data Storage and Security</h3>
            <p><strong>On-Device Storage:</strong> All calculation inputs, location data, and thermostat files are processed and stored locally on your device by default. This data is not automatically uploaded to our servers.</p>
            <p className="mt-2"><strong>Cloud Services:</strong> If you use optional cloud backup or export features (if available), data may be transmitted to secure cloud storage. These services are subject to their own privacy policies.</p>
            <p className="mt-2"><strong>Security Measures:</strong> We implement industry-standard encryption and security practices. However, no method of transmission or storage is 100% secure. We cannot guarantee absolute security of your data.</p>
          </div>

          {/* Third-Party Services */}
          <div>
            <h3 className="font-bold text-lg text-gray-800 dark:text-gray-100 mb-2">4. Third-Party Services and Data Sharing</h3>
            <p><strong>Weather Data:</strong> We use third-party weather APIs (e.g., OpenWeather, NOAA) to fetch forecast data. Your location is transmitted to these services for this purpose. Review their privacy policies:</p>
            <ul className="list-disc ml-5 mt-2 space-y-1">
              <li>Third-party weather providers may log your location queries</li>
              <li>We select providers that do not retain location data beyond the query</li>
            </ul>
            
            <p className="mt-3"><strong>Analytics:</strong> We use Google Analytics to track usage metrics. Analytics data does not include personal identifiers or sensitive calculation data. You can opt out through your device settings.</p>
            
            <p className="mt-3"><strong>We Do Not Share Your Data:</strong> We will not sell, trade, or share your personal data (location, thermostat files, or calculation inputs) with third parties for marketing purposes.</p>
          </div>

          {/* User Rights and Control */}
          <div>
            <h3 className="font-bold text-lg text-gray-800 dark:text-gray-100 mb-2">5. Your Rights and Data Control</h3>
            <p><strong>Access and Deletion:</strong> Since your data is stored on your device, you can delete the App at any time to remove all associated data.</p>
            <p className="mt-2"><strong>Opt-Out of Analytics:</strong> You can disable analytics collection in the App's Settings menu.</p>
            <p className="mt-2"><strong>Location Services:</strong> You can revoke the App's location permission at any time through your device's privacy settings.</p>
            <p className="mt-2"><strong>Export Your Data:</strong> Any calculations or results you create remain your property and can be exported or deleted at your discretion.</p>
          </div>

          {/* Children's Privacy */}
          <div>
            <h3 className="font-bold text-lg text-gray-800 dark:text-gray-100 mb-2">6. Children's Privacy</h3>
            <p>The App is not intended for children under 13. We do not knowingly collect personal information from children under 13. If we become aware that we have collected information from a child under 13, we will take steps to delete such information promptly. Parents or guardians who believe their child has provided information to the App should contact us immediately.</p>
          </div>

          {/* Data Retention */}
          <div>
            <h3 className="font-bold text-lg text-gray-800 dark:text-gray-100 mb-2">7. Data Retention</h3>
            <p><strong>Local Data:</strong> Stored on your device indefinitely until you manually delete the app or clear its data.</p>
            <p className="mt-2"><strong>Server-Side Analytics:</strong> Aggregate, anonymized analytics data is retained for up to 26 months to track long-term usage trends.</p>
            <p className="mt-2"><strong>Support Requests:</strong> If you contact us, we retain correspondence for up to 2 years to address follow-up questions.</p>
          </div>

          {/* Data Transfer and International Users */}
          <div>
            <h3 className="font-bold text-lg text-gray-800 dark:text-gray-100 mb-2">8. International Users and GDPR/CCPA Compliance</h3>
            <p><strong>GDPR (European Union):</strong> If you are located in the EU and have provided personal data, you have the right to:</p>
            <ul className="list-disc ml-5 mt-2 space-y-1">
              <li>Access your data</li>
              <li>Correct inaccurate data</li>
              <li>Delete your data (right to be forgotten)</li>
              <li>Restrict or object to processing</li>
            </ul>
            
            <p className="mt-3"><strong>CCPA (California):</strong> If you are a California resident, you have the right to know what personal information is collected, to request deletion, and to opt-out of any data sales (which we do not do).</p>
            
            <p className="mt-3">To exercise these rights, contact us through the app's support section.</p>
          </div>

          {/* Changes to Privacy Policy */}
          <div>
            <h3 className="font-bold text-lg text-gray-800 dark:text-gray-100 mb-2">9. Changes to This Privacy Policy</h3>
            <p>We may update this Privacy Policy from time to time. We will notify you of significant changes by updating the "Last Updated" date and, if required, by posting a prominent notice in the App. Your continued use of the App after any modifications constitutes your acceptance of the updated Privacy Policy.</p>
          </div>

          {/* Contact Us */}
          <div>
            <h3 className="font-bold text-lg text-gray-800 dark:text-gray-100 mb-2">10. Contact Us</h3>
            <p>If you have questions about this Privacy Policy, your data, or wish to exercise your privacy rights, please contact us through:</p>
            <ul className="list-disc ml-5 mt-2 space-y-1">
              <li>In-App Support (Settings → Help & Feedback)</li>
              <li>Email: [your-email-address]</li>
              <li>Mailing Address: [your-address]</li>
            </ul>
          </div>

          <div className="border-t border-gray-300 dark:border-gray-600 pt-4 mt-6">
            <p className="text-xs text-gray-600 dark:text-gray-400"><strong>DISCLAIMER:</strong> This document is provided as a template. You should consult with a legal professional and privacy specialist to customize this policy for your specific jurisdiction, use cases, and business needs. Update placeholders with your actual contact information and data practices.</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PrivacyPolicy;
