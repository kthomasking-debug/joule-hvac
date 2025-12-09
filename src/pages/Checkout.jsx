import React from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, Shield, ShoppingCart, MessageCircle } from "lucide-react";
import AskJoule from "../components/AskJoule";
import { EBAY_STORE_URL } from "../utils/rag/salesFAQ";

export default function Checkout() {
  const navigate = useNavigate();

  const handleBuyNow = () => {
    window.open(EBAY_STORE_URL, "_blank", "noopener,noreferrer");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl md:text-5xl font-bold text-gray-900 dark:text-white mb-4">
            Ready to Purchase Joule Bridge?
          </h1>
          <p className="text-xl text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
            Ask any questions below, then proceed to checkout on eBay
          </p>
        </div>

        {/* Main Content Grid */}
        <div className="grid lg:grid-cols-2 gap-8 mb-8">
          {/* Left Column - Ask Joule */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-6">
            <div className="mb-6">
              <div className="flex items-center gap-3 mb-2">
                <div className="bg-gradient-to-r from-blue-600 to-purple-600 p-3 rounded-xl">
                  <MessageCircle className="w-6 h-6 text-white" />
                </div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                  Ask Our Sales Engineer
                </h2>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Get instant answers about compatibility, pricing, shipping, features, and more before you buy
              </p>
            </div>
            
            <div className="[&_*]:text-gray-900 [&_input]:bg-white [&_input]:text-gray-900 [&_input]:placeholder:text-gray-400 [&_input]:border-gray-300 [&_button]:bg-blue-600 [&_button]:hover:bg-blue-700">
              <AskJoule
                userSettings={{}}
                userLocation={null}
                annualEstimate={null}
                recommendations={[]}
                hideHeader={true}
                salesMode={true}
              />
            </div>
          </div>

          {/* Right Column - Purchase Info */}
          <div className="space-y-6">
            {/* Product Summary */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-6">
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
                Joule Bridge
              </h3>
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-gray-600 dark:text-gray-400">Price</span>
                  <span className="text-2xl font-bold text-gray-900 dark:text-white">
                    $129
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600 dark:text-gray-400">Type</span>
                  <span className="text-gray-900 dark:text-white font-medium">
                    One-time purchase
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600 dark:text-gray-400">Subscription</span>
                  <span className="text-green-600 dark:text-green-400 font-medium">
                    None
                  </span>
                </div>
              </div>
              <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
                <div className="flex items-start gap-3 mb-4">
                  <Shield className="w-5 h-5 text-green-600 dark:text-green-400 mt-0.5" />
                  <div>
                    <p className="font-semibold text-gray-900 dark:text-white">
                      eBay Money Back Guarantee
                    </p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      30-day return window. If the item doesn't match the description, you're eligible for a full refund.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* CTA Button */}
            <button
              onClick={handleBuyNow}
              className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold py-4 px-6 rounded-xl transition-all duration-300 shadow-lg hover:shadow-xl flex items-center justify-center gap-3 group"
            >
              <ShoppingCart className="w-5 h-5 group-hover:scale-110 transition-transform" />
              <span>Buy Now on eBay</span>
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </button>

            {/* Trust Signals */}
            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-4 border border-blue-200 dark:border-blue-800">
              <p className="text-sm text-blue-900 dark:text-blue-200 text-center">
                <strong>Secure Checkout:</strong> All purchases are processed through eBay's secure payment system
              </p>
            </div>
          </div>
        </div>

        {/* Features Highlight */}
        <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-2xl shadow-xl p-8 text-white mb-8">
          <h3 className="text-2xl font-bold mb-6 text-center">What's Included</h3>
          <div className="grid md:grid-cols-3 gap-6">
            <div className="text-center">
              <div className="bg-white/20 rounded-full w-12 h-12 flex items-center justify-center mx-auto mb-3">
                <ShoppingCart className="w-6 h-6" />
              </div>
              <h4 className="font-semibold mb-2">Raspberry Pi Zero 2 W</h4>
              <p className="text-sm text-blue-100">
                Pre-configured hardware in premium aluminum case
              </p>
            </div>
            <div className="text-center">
              <div className="bg-white/20 rounded-full w-12 h-12 flex items-center justify-center mx-auto mb-3">
                <Shield className="w-6 h-6" />
              </div>
              <h4 className="font-semibold mb-2">32GB SD Card</h4>
              <p className="text-sm text-blue-100">
                Pre-flashed with Joule OS, ready to use
              </p>
            </div>
            <div className="text-center">
              <div className="bg-white/20 rounded-full w-12 h-12 flex items-center justify-center mx-auto mb-3">
                <MessageCircle className="w-6 h-6" />
              </div>
              <h4 className="font-semibold mb-2">Lifetime Updates</h4>
              <p className="text-sm text-blue-100">
                Free software updates included forever
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}




