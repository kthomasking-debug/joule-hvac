import React from 'react';
import { ReceiptText, ArrowLeft, Clock, Package, CreditCard, AlertTriangle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { DashboardLink } from '../components/DashboardLink';

export default function RefundPolicy() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-6 pb-20">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Refund Policy</h1>
          <p className="text-gray-600 dark:text-gray-400">Returns, refunds, and warranty information</p>
        </div>
        <DashboardLink />
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-8 mb-6 border dark:border-gray-700 space-y-8">
        
        {/* 30-Day Return Policy */}
        <section>
          <div className="flex items-center gap-3 mb-4">
            <Clock size={24} className="text-blue-600 dark:text-blue-400" />
            <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">30-Day Return Policy</h2>
          </div>
          <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 border border-blue-200 dark:border-blue-800">
            <p className="text-blue-800 dark:text-blue-300 mb-3">
              We offer a <strong>30-day money-back guarantee</strong> on all Joule Bridge hardware purchases.
            </p>
            <ul className="list-disc list-inside text-sm text-blue-700 dark:text-blue-400 space-y-2">
              <li>Return window: 30 days from delivery date</li>
              <li>Condition: Device must be in original, undamaged condition</li>
              <li>Includes: All original accessories and packaging</li>
              <li>Refund: Full purchase price minus original shipping cost</li>
            </ul>
          </div>
        </section>

        {/* How to Return */}
        <section>
          <div className="flex items-center gap-3 mb-4">
            <Package size={24} className="text-green-600 dark:text-green-400" />
            <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">How to Return</h2>
          </div>
          <div className="space-y-4">
            <div className="flex gap-4">
              <div className="flex-shrink-0 w-8 h-8 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center text-green-700 dark:text-green-300 font-bold">1</div>
              <div>
                <h3 className="font-semibold text-gray-900 dark:text-gray-100">Contact Support</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">Email support@joule-bridge.com with your order number and reason for return</p>
              </div>
            </div>
            <div className="flex gap-4">
              <div className="flex-shrink-0 w-8 h-8 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center text-green-700 dark:text-green-300 font-bold">2</div>
              <div>
                <h3 className="font-semibold text-gray-900 dark:text-gray-100">Receive Return Label</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">We'll email you a return shipping label within 1-2 business days</p>
              </div>
            </div>
            <div className="flex gap-4">
              <div className="flex-shrink-0 w-8 h-8 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center text-green-700 dark:text-green-300 font-bold">3</div>
              <div>
                <h3 className="font-semibold text-gray-900 dark:text-gray-100">Ship It Back</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">Pack the device securely and drop off at any USPS location</p>
              </div>
            </div>
            <div className="flex gap-4">
              <div className="flex-shrink-0 w-8 h-8 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center text-green-700 dark:text-green-300 font-bold">4</div>
              <div>
                <h3 className="font-semibold text-gray-900 dark:text-gray-100">Get Refunded</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">Refund processed within 5-7 business days of receiving the return</p>
              </div>
            </div>
          </div>
        </section>

        {/* Refund Details */}
        <section>
          <div className="flex items-center gap-3 mb-4">
            <CreditCard size={24} className="text-purple-600 dark:text-purple-400" />
            <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Refund Details</h2>
          </div>
          <div className="grid md:grid-cols-2 gap-4">
            <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
              <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-2">What's Refunded</h3>
              <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
                <li>✅ Full product purchase price</li>
                <li>✅ Applicable taxes</li>
                <li>✅ Any premium subscription fees (prorated)</li>
              </ul>
            </div>
            <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
              <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-2">Not Refunded</h3>
              <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
                <li>❌ Original shipping cost</li>
                <li>❌ Return shipping (buyer responsibility)</li>
                <li>❌ Damage caused by misuse</li>
              </ul>
            </div>
          </div>
        </section>

        {/* Warranty */}
        <section>
          <div className="flex items-center gap-3 mb-4">
            <ReceiptText size={24} className="text-amber-600 dark:text-amber-400" />
            <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">1-Year Limited Warranty</h2>
          </div>
          <div className="bg-amber-50 dark:bg-amber-900/20 rounded-lg p-4 border border-amber-200 dark:border-amber-800">
            <p className="text-amber-800 dark:text-amber-300 mb-3">
              All Joule Bridge hardware includes a <strong>1-year limited warranty</strong> covering:
            </p>
            <ul className="list-disc list-inside text-sm text-amber-700 dark:text-amber-400 space-y-1">
              <li>Manufacturing defects</li>
              <li>Component failures under normal use</li>
              <li>E-ink display malfunctions</li>
              <li>WiFi connectivity issues due to hardware</li>
            </ul>
            <p className="text-sm text-amber-700 dark:text-amber-400 mt-3">
              <strong>Not covered:</strong> Physical damage, water damage, modification, or misuse.
            </p>
          </div>
        </section>

        {/* Exceptions */}
        <section>
          <div className="flex items-center gap-3 mb-4">
            <AlertTriangle size={24} className="text-red-600 dark:text-red-400" />
            <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Non-Refundable Items</h2>
          </div>
          <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-4 border border-red-200 dark:border-red-800">
            <p className="text-red-800 dark:text-red-300 mb-2">The following cannot be returned or refunded:</p>
            <ul className="list-disc list-inside text-sm text-red-700 dark:text-red-400 space-y-1">
              <li>Devices with physical damage or tampering</li>
              <li>Devices without original packaging</li>
              <li>Returns requested after 30 days</li>
              <li>Software-only purchases (premium features)</li>
            </ul>
          </div>
        </section>

        {/* Contact */}
        <section className="border-t dark:border-gray-600 pt-6">
          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-4">Questions?</h2>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            We're here to help with any questions about returns or warranty claims.
          </p>
          <div className="flex flex-wrap gap-4">
            <a 
              href="mailto:support@joule-bridge.com" 
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Email Support
            </a>
            <Link 
              to="/support" 
              className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
            >
              Submit Ticket
            </Link>
          </div>
        </section>

      </div>

      {/* Last Updated */}
      <p className="text-center text-sm text-gray-500 dark:text-gray-400">
        Last updated: February 2026
      </p>
    </div>
  );
}
