/**
 * Landing page - moved to for-later for use as a separate website.
 * Original: src/pages/LandingPage.jsx
 */
import React from "react";
import { Link } from "react-router-dom";
import { EBAY_STORE_URL } from "../utils/rag/salesFAQ";
import { CheckCircle2 } from "lucide-react";

const LandingPage = () => {
  return (
    <div className="min-h-screen bg-white dark:bg-gray-900 flex flex-col">
      {/* Hero */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 py-16 md:py-24">
        <div className="max-w-2xl mx-auto text-center">
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-gray-900 dark:text-white mb-6 leading-tight">
            Why is your heating bill insane?
          </h1>
          <p className="text-xl md:text-2xl text-gray-600 dark:text-gray-300 mb-12">
            Plug this into your house and find out.
          </p>

          <ul className="space-y-4 mb-12 text-left max-w-md mx-auto">
            <li className="flex items-center gap-3 text-gray-700 dark:text-gray-300">
              <CheckCircle2 className="w-6 h-6 text-emerald-500 flex-shrink-0" />
              Upload your bill
            </li>
            <li className="flex items-center gap-3 text-gray-700 dark:text-gray-300">
              <CheckCircle2 className="w-6 h-6 text-emerald-500 flex-shrink-0" />
              See where your money goes
            </li>
            <li className="flex items-center gap-3 text-gray-700 dark:text-gray-300">
              <CheckCircle2 className="w-6 h-6 text-emerald-500 flex-shrink-0" />
              Find out if your system is inefficient
            </li>
            <li className="flex items-center gap-3 text-gray-700 dark:text-gray-300">
              <CheckCircle2 className="w-6 h-6 text-emerald-500 flex-shrink-0" />
              Get real numbers, not guesses
            </li>
          </ul>

          <p className="text-3xl font-bold text-gray-900 dark:text-white mb-8">
            $129 one-time
          </p>

          <a
            href={EBAY_STORE_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block px-12 py-4 bg-emerald-600 hover:bg-emerald-700 text-white text-lg font-bold rounded-lg transition-colors shadow-lg"
          >
            Figure out my bill
          </a>
        </div>
      </main>

      {/* Footer */}
      <footer className="py-6 px-4 border-t border-gray-200 dark:border-gray-800">
        <div className="max-w-2xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-gray-500 dark:text-gray-400">
          <Link to="/onboarding" className="hover:text-gray-900 dark:hover:text-white">
            Launch app
          </Link>
          <Link to="/docs/PRODUCT-TIERS.md" className="hover:text-gray-900 dark:hover:text-white">
            Product details
          </Link>
          <p>&copy; {new Date().getFullYear()} Joule</p>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
