import React from 'react';
import { Shield, Lock, Database, Trash2, Eye, FileText } from 'lucide-react';
import { Link } from 'react-router-dom';
import { DashboardLink } from '../components/DashboardLink';

export default function PrivacyPolicy() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-6 pb-20">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Privacy Policy</h1>
          <p className="text-gray-600 dark:text-gray-400">Your data privacy and security</p>
        </div>
        <DashboardLink />
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-8 mb-6 border dark:border-gray-700 space-y-8">
        {/* Introduction */}
        <section>
          <div className="flex items-center gap-3 mb-4">
            <Shield size={24} className="text-blue-600 dark:text-blue-400" />
            <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Data Privacy Commitment</h2>
          </div>
          <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
            Joule Bridge is designed with privacy as a core principle. We believe your energy data belongs to you, 
            and we've built this application to process everything locally in your browser. No data is sent to external 
            servers unless you explicitly choose to share it.
          </p>
        </section>

        {/* Data Storage */}
        <section>
          <div className="flex items-center gap-3 mb-4">
            <Database size={24} className="text-green-600 dark:text-green-400" />
            <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">How We Store Your Data</h2>
          </div>
          <div className="space-y-4">
            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 border border-blue-200 dark:border-blue-800">
              <h3 className="font-semibold text-blue-900 dark:text-blue-200 mb-2">Local Storage Only</h3>
              <p className="text-sm text-blue-800 dark:text-blue-300">
                All data is stored locally in your browser using localStorage and IndexedDB. This includes:
              </p>
              <ul className="list-disc list-inside text-sm text-blue-700 dark:text-blue-400 mt-2 space-y-1">
                <li>CSV analysis results and history</li>
                <li>User settings and preferences</li>
                <li>Zone configurations</li>
                <li>Thermostat data and diagnostics</li>
                <li>Location data (if provided)</li>
              </ul>
            </div>
            <p className="text-gray-700 dark:text-gray-300">
              <strong>No cloud storage:</strong> Your data never leaves your device unless you explicitly export or share it.
            </p>
          </div>
        </section>

        {/* Data Processing */}
        <section>
          <div className="flex items-center gap-3 mb-4">
            <Eye size={24} className="text-purple-600 dark:text-purple-400" />
            <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Data Processing</h2>
          </div>
          <div className="space-y-3">
            <p className="text-gray-700 dark:text-gray-300">
              All calculations and analysis are performed entirely in your browser using JavaScript. 
              This means:
            </p>
            <ul className="list-disc list-inside text-gray-700 dark:text-gray-300 space-y-2 ml-4">
              <li>CSV files are parsed and analyzed locally</li>
              <li>Heat loss calculations run on your device</li>
              <li>No data is transmitted to external servers</li>
              <li>Your information remains private and secure</li>
            </ul>
          </div>
        </section>

        {/* Third-Party Services */}
        <section>
          <div className="flex items-center gap-3 mb-4">
            <Lock size={24} className="text-orange-600 dark:text-orange-400" />
            <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Third-Party Services</h2>
          </div>
          <div className="space-y-3">
            <p className="text-gray-700 dark:text-gray-300">
              ProStat may use the following optional third-party services:
            </p>
            <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
              <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-2">Groq AI API (Optional)</h3>
              <p className="text-sm text-gray-700 dark:text-gray-300">
                If you choose to use the Ask Joule AI assistant feature, your questions are sent to Groq's API 
                for processing. Groq's privacy policy applies to this data. You can disable this feature at any time 
                by not providing an API key.
              </p>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              <strong>Note:</strong> The core analysis features (CSV parsing, heat loss calculations) work completely 
              offline and do not require any third-party services.
            </p>
          </div>
        </section>

        {/* Data Deletion */}
        <section>
          <div className="flex items-center gap-3 mb-4">
            <Trash2 size={24} className="text-red-600 dark:text-red-400" />
            <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Your Rights</h2>
          </div>
          <div className="space-y-4">
            <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4 border border-green-200 dark:border-green-800">
              <h3 className="font-semibold text-green-900 dark:text-green-200 mb-2">Complete Control</h3>
              <p className="text-sm text-green-800 dark:text-green-300 mb-3">
                You have full control over your data:
              </p>
              <ul className="list-disc list-inside text-sm text-green-700 dark:text-green-400 space-y-1">
                <li><strong>View:</strong> All data is stored in your browser - you can inspect it using browser developer tools</li>
                <li><strong>Export:</strong> Export your analysis results as JSON or CSV files</li>
                <li><strong>Delete:</strong> Delete individual analyses or all data at any time</li>
                <li><strong>Auto-cleanup:</strong> Old data (90+ days) is automatically cleaned up to save space</li>
              </ul>
            </div>
            <p className="text-gray-700 dark:text-gray-300">
              To delete all data, visit <Link to="/settings" className="text-blue-600 dark:text-blue-400 hover:underline">Settings</Link> and 
              use the "Delete All Data" option in the Data Management section.
            </p>
          </div>
        </section>

        {/* GDPR Compliance */}
        <section>
          <div className="flex items-center gap-3 mb-4">
            <FileText size={24} className="text-indigo-600 dark:text-indigo-400" />
            <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">GDPR Compliance</h2>
          </div>
          <div className="space-y-3">
            <p className="text-gray-700 dark:text-gray-300">
              Since all data processing happens locally in your browser, ProStat complies with GDPR principles:
            </p>
            <ul className="list-disc list-inside text-gray-700 dark:text-gray-300 space-y-2 ml-4">
              <li><strong>Right to Access:</strong> All your data is accessible through browser storage</li>
              <li><strong>Right to Rectification:</strong> You can modify or update your data at any time</li>
              <li><strong>Right to Erasure:</strong> Delete all data instantly using the Settings page</li>
              <li><strong>Right to Data Portability:</strong> Export your data in JSON or CSV format</li>
              <li><strong>No Data Sharing:</strong> We don't share your data with third parties</li>
            </ul>
          </div>
        </section>

        {/* Cookies and Tracking */}
        <section>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-4">Cookies and Tracking</h2>
          <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-lg p-4 border border-yellow-200 dark:border-yellow-800">
            <p className="text-sm text-yellow-800 dark:text-yellow-300">
              <strong>No tracking cookies:</strong> ProStat does not use tracking cookies or analytics services. 
              We don't collect usage statistics or personal information.
            </p>
          </div>
        </section>

        {/* Contact */}
        <section>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-4">Questions?</h2>
          <p className="text-gray-700 dark:text-gray-300">
            If you have questions about privacy or data handling, please review the source code (this is an open-source project) 
            or contact the development team through the project repository.
          </p>
        </section>

        {/* Last Updated */}
        <div className="pt-6 border-t border-gray-200 dark:border-gray-700">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Last updated: {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>
      </div>
    </div>
  );
}






