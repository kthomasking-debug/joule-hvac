import React, { useState } from 'react';
import { 
  MessageSquare, 
  Send, 
  CheckCircle, 
  AlertCircle,
  Copy,
  FileText,
  Server,
  Link as LinkIcon
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { useOptionalJouleBridge } from '../contexts/JouleBridgeContext';

/**
 * Support Ticket Submission Page
 * Allows users to submit support tickets with diagnostic information
 */
export default function SupportTicket() {
  const jouleBridge = useOptionalJouleBridge();
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    subject: '',
    description: '',
    includeDiagnostics: true,
  });
  const [submitted, setSubmitted] = useState(false);
  const [copyFeedback, setCopyFeedback] = useState('');

  // Generate diagnostic report
  const generateDiagnosticReport = () => {
    const lines = [
      '=== JOULE HVAC SUPPORT TICKET ===',
      `Generated: ${new Date().toISOString()}`,
      '',
      '--- User Information ---',
      `Name: ${formData.name || 'Not provided'}`,
      `Email: ${formData.email || 'Not provided'}`,
      '',
      '--- Issue Description ---',
      `Subject: ${formData.subject || 'No subject'}`,
      `Description: ${formData.description || 'No description'}`,
      '',
      '--- System Information ---',
      `Browser: ${navigator.userAgent}`,
      `Platform: ${navigator.platform}`,
      `Screen: ${window.screen.width}x${window.screen.height}`,
      '',
    ];

    if (jouleBridge) {
      lines.push('--- Bridge Status ---');
      lines.push(`Bridge Available: ${jouleBridge.bridgeAvailable ? 'Yes' : 'No'}`);
      lines.push(`Connected: ${jouleBridge.connected ? 'Yes' : 'No'}`);
      if (jouleBridge.error) {
        lines.push(`Error: ${jouleBridge.error}`);
      }
      if (jouleBridge.thermostatData) {
        lines.push(`Temperature: ${jouleBridge.thermostatData.temperature}°F`);
        lines.push(`Mode: ${jouleBridge.thermostatData.mode}`);
      }
      lines.push('');
    }

    // Get bridge URL from localStorage
    const bridgeUrl = localStorage.getItem('jouleBridgeUrl');
    if (bridgeUrl) {
      lines.push('--- Bridge Configuration ---');
      lines.push(`Bridge URL: ${bridgeUrl}`);
      lines.push('');
    }

    lines.push('=== END REPORT ===');
    return lines.join('\n');
  };

  // Copy diagnostic report to clipboard
  const copyDiagnosticReport = () => {
    const report = generateDiagnosticReport();
    navigator.clipboard.writeText(report).then(() => {
      setCopyFeedback('Copied!');
      setTimeout(() => setCopyFeedback(''), 2000);
    }).catch(() => {
      setCopyFeedback('Failed to copy');
      setTimeout(() => setCopyFeedback(''), 2000);
    });
  };

  // Support email address
  const SUPPORT_EMAIL = 'kthomasking@gmail.com';
  
  // Handle form submission - opens email client with ticket
  const handleSubmit = (e) => {
    e.preventDefault();
    
    const ticket = generateDiagnosticReport();
    
    // Build mailto URL
    const subject = encodeURIComponent(`[Support] ${formData.subject}`);
    const body = encodeURIComponent(ticket);
    const mailtoUrl = `mailto:${SUPPORT_EMAIL}?subject=${subject}&body=${body}`;
    
    // Also copy to clipboard as backup
    navigator.clipboard.writeText(ticket).catch(() => {});
    
    // Open email client
    window.open(mailtoUrl, '_blank');
    
    setSubmitted(true);
    // Reset form after 5 seconds
    setTimeout(() => {
      setSubmitted(false);
      setFormData({
        name: '',
        email: '',
        subject: '',
        description: '',
        includeDiagnostics: true,
      });
    }, 5000);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 p-6">
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <MessageSquare className="w-8 h-8 text-blue-600 dark:text-blue-400" />
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Support Ticket</h1>
            <p className="text-gray-600 dark:text-gray-400">Get help with your Joule HVAC system</p>
          </div>
        </div>

        {submitted ? (
          /* Success Message */
          <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl p-6">
            <div className="flex items-center gap-3 mb-4">
              <CheckCircle className="w-6 h-6 text-green-600 dark:text-green-400" />
              <h2 className="text-xl font-semibold text-green-900 dark:text-green-100">
                Email Client Opened!
              </h2>
            </div>
            <p className="text-green-800 dark:text-green-200 mb-4">
              Your email client should have opened with the support ticket pre-filled. 
              Just click Send to submit your ticket.
            </p>
            <div className="bg-white dark:bg-gray-800 rounded-lg p-4 mb-4">
              <p className="text-sm text-gray-700 dark:text-gray-300 mb-2">
                <strong>If your email client didn't open:</strong>
              </p>
              <p className="font-mono text-sm text-gray-900 dark:text-white mb-2">
                {SUPPORT_EMAIL}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                The ticket has also been copied to your clipboard - paste it into your email.
              </p>
            </div>
            <p className="text-sm text-green-700 dark:text-green-300">
              Thank you for contacting support! We'll respond within 24-48 hours.
            </p>
          </div>
        ) : (
          /* Support Form */
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Personal Information */}
            <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Your Information
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    placeholder="John Doe"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Email *
                  </label>
                  <input
                    type="email"
                    required
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    placeholder="john@example.com"
                  />
                </div>
              </div>
            </div>

            {/* Issue Description */}
            <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Issue Description
              </h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Subject *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.subject}
                    onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                    className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    placeholder="e.g., Bridge won't connect, Ecobee pairing failed"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Description *
                  </label>
                  <textarea
                    required
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    rows={6}
                    className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    placeholder="Please describe your issue in detail. Include steps to reproduce, error messages, and what you've already tried."
                  />
                </div>
              </div>
            </div>

            {/* Diagnostic Information */}
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-6">
              <div className="flex items-start gap-3 mb-4">
                <input
                  type="checkbox"
                  id="includeDiagnostics"
                  checked={formData.includeDiagnostics}
                  onChange={(e) => setFormData({ ...formData, includeDiagnostics: e.target.checked })}
                  className="mt-1"
                />
                <div className="flex-1">
                  <label htmlFor="includeDiagnostics" className="block text-sm font-medium text-blue-900 dark:text-blue-100 mb-2">
                    Include Diagnostic Information
                  </label>
                  <p className="text-sm text-blue-800 dark:text-blue-200">
                    Automatically include system information, bridge status, and configuration details to help us diagnose your issue faster.
                  </p>
                </div>
              </div>
              
              {formData.includeDiagnostics && (
                <div className="mt-4">
                  <button
                    type="button"
                    onClick={copyDiagnosticReport}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors text-sm"
                  >
                    <Copy className="w-4 h-4" />
                    {copyFeedback || 'Preview Diagnostic Report'}
                  </button>
                  {copyFeedback && (
                    <p className="text-xs text-blue-600 dark:text-blue-400 mt-2">
                      {copyFeedback}
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Submit Button */}
            <div className="flex gap-3">
              <button
                type="submit"
                className="flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors font-medium"
              >
                <Send className="w-5 h-5" />
                Generate Support Ticket
              </button>
              <Link
                to="/bridge-support"
                className="flex items-center gap-2 px-6 py-3 bg-slate-600 hover:bg-slate-500 text-white rounded-lg transition-colors font-medium"
              >
                <Server className="w-5 h-5" />
                Bridge Diagnostics
              </Link>
            </div>
          </form>
        )}

        {/* Help Section */}
        <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-6 border border-slate-200 dark:border-slate-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            Before Submitting
          </h2>
          <ul className="space-y-2 text-sm text-gray-700 dark:text-gray-300">
            <li className="flex items-start gap-2">
              <span className="text-blue-600 dark:text-blue-400">•</span>
              <span>Read the <Link to="/docs/USER_MANUAL.md" className="text-blue-600 dark:text-blue-400 underline">User Manual</Link> for setup and troubleshooting</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-blue-600 dark:text-blue-400">•</span>
              <span>Check the <Link to="/tools" className="text-blue-600 dark:text-blue-400 underline">Tools</Link> section for troubleshooting guides</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-blue-600 dark:text-blue-400">•</span>
              <span>Review the <Link to="/config#joule-bridge" className="text-blue-600 dark:text-blue-400 underline">Bridge Settings</Link> page for connection issues</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-blue-600 dark:text-blue-400">•</span>
              <span>Include as much detail as possible - error messages, screenshots, and steps to reproduce</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-blue-600 dark:text-blue-400">•</span>
              <span>If your bridge is accessible, use the <Link to="/bridge-support" className="text-blue-600 dark:text-blue-400 underline">Bridge Diagnostics</Link> page to copy diagnostic information</span>
            </li>
          </ul>
        </div>

        {/* Quick Links */}
        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Quick Links
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Link
              to="/bridge-support"
              className="flex items-center gap-3 p-4 bg-slate-50 dark:bg-slate-700 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-600 transition-colors"
            >
              <Server className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              <div>
                <p className="font-medium text-gray-900 dark:text-white">Bridge Diagnostics</p>
                <p className="text-sm text-gray-600 dark:text-gray-400">Check status, view logs, and troubleshoot</p>
              </div>
            </Link>
            <Link
              to="/config#joule-bridge"
              className="flex items-center gap-3 p-4 bg-slate-50 dark:bg-slate-700 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-600 transition-colors"
            >
              <FileText className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              <div>
                <p className="font-medium text-gray-900 dark:text-white">Bridge Settings</p>
                <p className="text-sm text-gray-600 dark:text-gray-400">Configure and pair your bridge</p>
              </div>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

