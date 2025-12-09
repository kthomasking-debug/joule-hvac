import React, { useState, useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  ShoppingCart,
  Check,
  X,
  ArrowRight,
  Shield,
  Zap,
  Brain,
  Home,
  Wifi,
  WifiOff,
  Clock,
  TrendingDown,
  Lock,
  MessageCircle,
  Headphones,
} from "lucide-react";
import AskJoule from "../components/AskJoule";
import { EBAY_STORE_URL } from "../utils/rag/salesFAQ";

// Product definitions - mapped to new tier structure
const PRODUCTS = {
  bridge: {
    id: "bridge",
    name: "Bridge",
    tagline: "Controller",
    price: { monthly: null, annual: null, oneTime: 129 },
    description: "One-time purchase • Pi Zero 2 W • The standard brain",
    features: [
      { text: "Everything in Free tier", included: true },
      { text: "Pi Zero 2 W hardware included", included: true },
      { text: "Local control & short cycle protection", included: true },
      { text: "Automatic data logging", included: true },
      { text: "Full thermostat control (setpoints, schedules)", included: true },
      { text: "Works completely offline", included: true },
      { text: "Cloud AI ready (bring your own API key)", included: true },
    ],
    cta: "Buy Now - $129",
    popular: true,
    gradient: "from-blue-500 to-cyan-500",
    ebayUrl: "https://www.ebay.com/usr/firehousescorpions",
  },
  core: {
    id: "core",
    name: "Core",
    tagline: "Privacy First",
    price: { monthly: null, annual: null, oneTime: 299 },
    description: "Upgrade to local processing. Your data never leaves your home. One-time purchase, lifetime control.",
    features: [
      { text: "Everything in Bridge", included: true },
      { text: "ProStat Core hardware included", included: true },
      { text: "100% Air-Gapped Operation", included: true },
      { text: "Local AI Neural Engine", included: true },
      { text: "Industrial Aluminum Housing", included: true },
      { text: "Faster response times", included: true },
      { text: "HomeKit integration", included: true },
      { text: "Advanced pattern learning", included: true },
    ],
    cta: "Buy Now",
    popular: true,
    gradient: "from-violet-500 to-purple-600",
    badge: "Ultimate Privacy",
    ebayUrl: "https://www.ebay.com/usr/firehousescorpions",
  },
  elite: {
    id: "elite",
    name: "Elite",
    tagline: "Coming Soon",
    price: { monthly: null, annual: null, oneTime: "TBA" },
    description: "Professional-grade control with multi-zone support, predictive AI, and premium features.",
    features: [
      { text: "Everything in Core", included: true },
      { text: "Multi-zone management", included: true },
      { text: "Predictive climate AI", included: true },
      { text: "Energy cost optimization", included: true },
      { text: "Professional installation", included: true },
      { text: "Priority support", included: true },
      { text: "Advanced analytics", included: true },
      { text: "Integration marketplace", included: true },
      { text: "Lifetime warranty", included: true },
    ],
    cta: "Join Waitlist",
    popular: false,
    gradient: "from-amber-500 to-orange-600",
    ebayUrl: "https://www.ebay.com/usr/firehousescorpions",
  },
};

export default function Upgrades() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [cart, setCart] = useState([]);
  // Initialize showCart from URL on mount
  const [showCart, setShowCart] = useState(() => {
    return searchParams.get("showCart") === "true";
  });
  const [showCheckout, setShowCheckout] = useState(false);
  const [billingCycle] = useState("monthly"); // For future billing cycle switching
  const [hoveredTier, setHoveredTier] = useState(null);
  const isUpdatingFromUrl = useRef(false);

  // Sync showCart state with URL parameter for browser navigation
  useEffect(() => {
    const showCartParam = searchParams.get("showCart");
    const shouldShowCart = showCartParam === "true";
    
    if (shouldShowCart !== showCart) {
      isUpdatingFromUrl.current = true;
      setShowCart(shouldShowCart);
      // Reset checkout when cart is closed via URL
      if (!shouldShowCart) {
        setShowCheckout(false);
      }
      // Reset flag after state update
      setTimeout(() => {
        isUpdatingFromUrl.current = false;
      }, 0);
    }
  }, [searchParams, showCart]);

  // Update URL when showCart changes from user action (for browser navigation support)
  useEffect(() => {
    // Skip if this update came from URL to prevent loops
    if (isUpdatingFromUrl.current) {
      return;
    }

    const currentShowCart = searchParams.get("showCart") === "true";
    
    if (showCart !== currentShowCart) {
      const newParams = new URLSearchParams(searchParams);
      if (showCart) {
        newParams.set("showCart", "true");
      } else {
        newParams.delete("showCart");
      }
      setSearchParams(newParams, { replace: true });
    }
  }, [showCart, searchParams, setSearchParams]);

  // Handle URL query parameters to auto-add products to cart
  useEffect(() => {
    const productParam = searchParams.get("product");
    const showCartParam = searchParams.get("showCart");

    if (productParam && PRODUCTS[productParam]) {
      setCart((currentCart) => {
        const exists = currentCart.find((item) => item.id === productParam);
        if (exists) {
          return currentCart;
        }

        const product = PRODUCTS[productParam];
        const filteredCart = currentCart.filter(
          (item) => !(item.id === "bridge" && productParam === "bridge")
        );
        return [...filteredCart, { ...product, quantity: 1 }];
      });

      if (showCartParam === "true") {
        setShowCart(true);
      }

      // Clear product param but keep showCart if it was set
      const newParams = new URLSearchParams(searchParams);
      newParams.delete("product");
      if (showCartParam === "true") {
        newParams.set("showCart", "true");
      }
      setSearchParams(newParams, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  const addToCart = (productId) => {
    const product = PRODUCTS[productId];
    if (!product) return;

    const filteredCart = cart.filter(
      (item) => !(item.id === "bridge" && productId === "bridge")
    );

    const exists = filteredCart.find((item) => item.id === productId);
    if (exists) {
      setShowCart(true);
      return;
    }

    setCart([...filteredCart, { ...product, quantity: 1 }]);
    setShowCart(true);
  };

  const removeFromCart = (productId) => {
    setCart(cart.filter((item) => item.id !== productId));
  };

  const getCartTotal = () => {
    return cart.reduce((total, item) => {
      if (item.price.oneTime) {
        return total + (typeof item.price.oneTime === "number" ? item.price.oneTime : 0);
      }
      const price = billingCycle === "monthly" ? item.price.monthly : item.price.annual;
      return total + (price || 0);
    }, 0);
  };

  const getCartCount = () => {
    return cart.length;
  };

  const formatPrice = (price, type) => {
    if (type === "oneTime") {
      return typeof price === "number" ? `$${price}` : price;
    }
    if (type === "year") {
      return `$${price}/year`;
    }
    return `$${price}/month`;
  };

  const benefits = [
    {
      icon: Lock,
      title: "Privacy Guaranteed",
      description: "With Core, your data stays on your network. No cloud. No tracking. No compromises.",
    },
    {
      icon: Brain,
      title: "Smart Learning",
      description: "AI that adapts to your schedule and preferences, reducing energy waste automatically.",
    },
    {
      icon: TrendingDown,
      title: "Lower Bills",
      description: "Users save an average of 23% on heating and cooling costs in the first year.",
    },
    {
      icon: WifiOff,
      title: "Works Offline",
      description: "Internet down? No problem. Core keeps working with full functionality.",
    },
  ];

  // Filter out Elite tier - only show what customers can buy today
  const tiers = Object.values(PRODUCTS).filter(tier => tier.id !== "elite");

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white">
      {/* Header */}
      <header className="border-b border-slate-700/50 backdrop-blur-sm bg-slate-900/50 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-violet-500 to-cyan-400 rounded-lg flex items-center justify-center">
              <Zap className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold">Joule</h1>
              <p className="text-xs text-slate-400">ProStat Products & Services</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={() => setShowCart(!showCart)}
              className="relative p-2 hover:bg-slate-700/50 rounded-lg transition-colors"
            >
              <ShoppingCart className="w-6 h-6" />
              {getCartCount() > 0 && (
                <span className="absolute -top-1 -right-1 bg-orange-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                  {getCartCount()}
                </span>
              )}
            </button>
            <button
              onClick={() => navigate("/dashboard")}
              className="text-slate-300 hover:text-white text-sm"
            >
              Back to Dashboard
            </button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-violet-600/20 via-transparent to-cyan-600/20" />
        <div className="absolute inset-0">
          <div className="absolute top-20 left-20 w-72 h-72 bg-violet-500/30 rounded-full blur-3xl animate-pulse" />
          <div
            className="absolute bottom-20 right-20 w-96 h-96 bg-cyan-500/20 rounded-full blur-3xl animate-pulse"
            style={{ animationDelay: "1s" }}
          />
        </div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-16">
          <div className="flex items-center justify-center mb-6">
            <Zap className="w-12 h-12 text-violet-400 mr-3" />
            <h1 className="text-5xl font-bold bg-gradient-to-r from-violet-400 to-cyan-400 bg-clip-text text-transparent">
              Joule
            </h1>
          </div>

          <h2 className="text-6xl font-bold text-center mb-6">
            Take Control of Your
            <span className="block bg-gradient-to-r from-violet-400 via-purple-400 to-cyan-400 bg-clip-text text-transparent">
              Home Energy
            </span>
          </h2>

          <p className="text-xl text-slate-300 text-center max-w-3xl mx-auto mb-12">
            Intelligent HVAC control that learns your habits, protects your privacy, and slashes your
            energy bills. Choose cloud convenience or local-first power.
          </p>

          {/* Benefits Grid */}
          <div className="grid md:grid-cols-4 gap-6 mb-16">
            {benefits.map((benefit, idx) => {
              const Icon = benefit.icon;
              return (
                <div
                  key={idx}
                  className="bg-white/5 backdrop-blur-sm rounded-xl p-6 border border-white/10 hover:border-violet-500/50 transition-all"
                >
                  <Icon className="w-10 h-10 text-violet-400 mb-4" />
                  <h3 className="font-semibold text-lg mb-2">{benefit.title}</h3>
                  <p className="text-sm text-slate-400">{benefit.description}</p>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Pricing Section */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 pb-32">
        <h3 className="text-4xl font-bold text-center mb-4">Choose Your Plan</h3>
        <p className="text-slate-400 text-center mb-12">
          Start with Bridge, upgrade to Core for ultimate control
        </p>

        {/* Pricing Cards */}
        <div className="grid lg:grid-cols-2 gap-8 mb-16 max-w-5xl mx-auto">
          {tiers.map((tier, idx) => (
            <div
              key={idx}
              onMouseEnter={() => setHoveredTier(idx)}
              onMouseLeave={() => setHoveredTier(null)}
              className={`relative rounded-2xl overflow-hidden transition-all duration-300 ${
                tier.popular
                  ? "scale-105 shadow-2xl shadow-violet-500/50"
                  : "shadow-xl hover:scale-105"
              } ${hoveredTier === idx ? "shadow-2xl" : ""}`}
            >
              {/* Card Background */}
              <div className={`absolute inset-0 bg-gradient-to-br ${tier.gradient} opacity-10`} />
              <div className="absolute inset-0 bg-slate-800/90 backdrop-blur-sm" />

              {/* Popular Badge */}
              {tier.popular && (
                <div className="absolute top-0 right-0 bg-gradient-to-r from-orange-500 to-red-600 text-white px-4 py-1 text-sm font-semibold rounded-bl-lg">
                  POPULAR
                </div>
              )}
              {tier.badge && !tier.popular && (
                <div className="absolute top-0 right-0 bg-gradient-to-r from-violet-500 to-purple-600 text-white px-4 py-1 text-sm font-semibold rounded-bl-lg">
                  {tier.badge}
                </div>
              )}

              <div className="relative p-8">
                {/* Header */}
                <div className="mb-6">
                  <h4 className="text-3xl font-bold mb-2">{tier.name}</h4>
                  <p className="text-slate-400 text-sm mb-4">{tier.tagline}</p>

                  {/* Price */}
                  <div className="mb-4">
                    {tier.price.oneTime ? (
                      <div>
                        <span className="text-5xl font-bold">${tier.price.oneTime}</span>
                        {typeof tier.price.oneTime === "number" && (
                          <span className="text-slate-400 ml-2">one-time</span>
                        )}
                      </div>
                    ) : (
                      <div>
                        <span className="text-5xl font-bold">
                          ${billingCycle === "monthly" ? tier.price.monthly : tier.price.annual}
                        </span>
                        <span className="text-slate-400 ml-2">/month</span>
                        {billingCycle === "annual" && (
                          <div className="text-sm text-green-400 mt-1">Save 20% annually</div>
                        )}
                      </div>
                    )}
                  </div>

                  <p className="text-slate-300 text-sm leading-relaxed">{tier.description}</p>
                </div>

                {/* CTA Button */}
                {tier.id === "bridge" ? (
                  <a
                    href={tier.ebayUrl || EBAY_STORE_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`w-full py-4 px-6 rounded-xl font-semibold transition-all mb-8 block text-center ${
                      tier.popular
                        ? `bg-gradient-to-r ${tier.gradient} hover:shadow-2xl hover:shadow-violet-500/70 text-white text-lg font-bold animate-pulse hover:animate-none`
                        : "bg-white/10 hover:bg-white/20 border border-white/20"
                    }`}
                  >
                    {tier.cta} (add on ebay)
                  </a>
                ) : (
                  <button
                    onClick={() => {
                      if (tier.id === "elite") {
                        // Join waitlist - could navigate or show modal
                        return;
                      }
                      addToCart(tier.id);
                    }}
                    className={`w-full py-4 px-6 rounded-xl font-semibold transition-all mb-8 ${
                      tier.popular
                        ? `bg-gradient-to-r ${tier.gradient} hover:shadow-2xl hover:shadow-violet-500/70 text-white text-lg font-bold animate-pulse hover:animate-none`
                        : "bg-white/10 hover:bg-white/20 border border-white/20"
                    }`}
                  >
                    {tier.cta}
                  </button>
                )}

                {/* Features List */}
                <div className="space-y-3">
                  {tier.features.map((feature, fIdx) => (
                    <div key={fIdx} className="flex items-start">
                      {feature.included ? (
                        <Check className="w-5 h-5 text-green-400 mr-3 mt-0.5 flex-shrink-0" />
                      ) : (
                        <X className="w-5 h-5 text-slate-600 mr-3 mt-0.5 flex-shrink-0" />
                      )}
                      <span className={feature.included ? "text-slate-200" : "text-slate-600"}>
                        {feature.text}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Tech Specs for Core */}
        <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl p-8 border border-violet-500/30 mb-16">
          <h4 className="text-2xl font-bold mb-6 flex items-center">
            <Brain className="w-8 h-8 text-violet-400 mr-3" />
            ProStat Core Technical Specs
          </h4>
          <div className="grid md:grid-cols-3 gap-6">
            <div>
              <h5 className="font-semibold text-violet-400 mb-2">Processing Power</h5>
              <ul className="text-sm text-slate-300 space-y-1">
                <li>• Quad-Core 2.4GHz ARM</li>
                <li>• 16GB LPDDR4 Memory</li>
                <li>• NVMe-Ready Storage</li>
              </ul>
            </div>
            <div>
              <h5 className="font-semibold text-violet-400 mb-2">Intelligence</h5>
              <ul className="text-sm text-slate-300 space-y-1">
                <li>• On-device AI neural engine</li>
                <li>• Pattern recognition learning</li>
                <li>• Sub-100ms response time</li>
              </ul>
            </div>
            <div>
              <h5 className="font-semibold text-violet-400 mb-2">Connectivity</h5>
              <ul className="text-sm text-slate-300 space-y-1">
                <li>• HomeKit certified</li>
                <li>• Zigbee & Z-Wave ready</li>
                <li>• Works without internet</li>
              </ul>
            </div>
          </div>
        </div>

        {/* FAQ / Comparison */}
        <div className="mb-16 text-center">
          <h4 className="text-2xl font-bold mb-6">Why Choose Core Over Bridge?</h4>
          <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto text-left">
            <div className="bg-slate-800/50 rounded-xl p-6 border border-white/10">
              <Shield className="w-10 h-10 text-blue-400 mb-4" />
              <h5 className="font-semibold text-lg mb-2">Complete Privacy</h5>
              <p className="text-sm text-slate-400">
                Core processes everything locally. Your habits, schedules, and data never touch the
                cloud. Perfect for privacy-conscious users.
              </p>
            </div>
            <div className="bg-slate-800/50 rounded-xl p-6 border border-white/10">
              <Clock className="w-10 h-10 text-violet-400 mb-4" />
              <h5 className="font-semibold text-lg mb-2">No Monthly Fees</h5>
              <p className="text-sm text-slate-400">
                Bridge costs $180/year. Core pays for itself in under 2 years with no recurring
                costs. Own your hardware, keep your money.
              </p>
            </div>
          </div>
        </div>

        {/* Customer Service Chat Section */}
        <div className="bg-gradient-to-br from-blue-900/80 to-indigo-900/80 backdrop-blur-sm rounded-2xl p-8 border-2 border-blue-500/30 shadow-2xl mb-16">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 bg-blue-500 rounded-full flex items-center justify-center shadow-lg">
              <Headphones className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="text-2xl font-bold text-white">Customer Support</h3>
              <p className="text-blue-200 text-sm">
                Ask our AI assistant about products, shipping, compatibility, and more
              </p>
            </div>
          </div>

          {/* Ask Joule Component - Customer Service Styled */}
          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20 mb-6">
            <div className="mb-4">
              <div className="flex items-center gap-2 mb-2">
                <MessageCircle className="w-5 h-5 text-blue-300" />
                <h4 className="text-lg font-semibold text-white">Ask Our Sales Engineer</h4>
              </div>
              <p className="text-sm text-blue-200">
                Get instant answers about compatibility, pricing, shipping, and features
              </p>
            </div>
            <div className="[&_*]:text-white [&_input]:bg-white/20 [&_input]:text-white [&_input]:placeholder:text-blue-200 [&_input]:border-white/30 [&_button]:bg-blue-500 [&_button]:hover:bg-blue-600 [&_.text-gray-900]:text-white [&_.text-gray-600]:text-blue-200 [&_.text-gray-400]:text-blue-300 [&_.dark\\:text-gray-100]:text-white [&_.dark\\:text-gray-400]:text-blue-200">
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

          {/* Message Seller Button */}
          <a
            href={EBAY_STORE_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold py-4 px-6 rounded-xl transition-all duration-300 shadow-lg hover:shadow-xl flex items-center justify-center gap-3 group"
          >
            <MessageCircle className="w-5 h-5 group-hover:scale-110 transition-transform" />
            <span>Message Seller on eBay</span>
            <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
          </a>
          <p className="text-xs text-blue-200 text-center mt-3">
            Need personalized help? Contact us directly through eBay messaging
          </p>
        </div>
      </div>

      {/* Footer CTA */}
      <div className="bg-gradient-to-r from-violet-600 to-purple-600 py-16">
        <div className="max-w-4xl mx-auto text-center px-4">
          <h3 className="text-4xl font-bold mb-4">Ready to Save Energy?</h3>
          <p className="text-xl text-violet-100 mb-8">
            Join thousands of homeowners who've cut their HVAC costs by an average of 23%
          </p>
          <div className="flex justify-center gap-4">
            <button
              onClick={() => addToCart("bridge")}
              className="bg-white text-violet-600 px-8 py-4 rounded-xl font-semibold text-lg hover:bg-violet-50 transition-all shadow-xl"
            >
              Start Free Trial
            </button>
            <button
              onClick={() => navigate("/dashboard")}
              className="bg-violet-700 px-8 py-4 rounded-xl font-semibold text-lg hover:bg-violet-800 transition-all border border-white/20"
            >
              View Demo
            </button>
          </div>
        </div>
      </div>

      {/* Cart Sidebar */}
      {showCart && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-end">
          <div className="bg-slate-900 w-full max-w-md h-full overflow-y-auto shadow-2xl">
            <div className="sticky top-0 bg-slate-900 border-b border-slate-700 p-6 flex items-center justify-between">
              <h3 className="text-2xl font-bold">Shopping Cart</h3>
              <button
                onClick={() => {
                  setShowCart(false);
                  setShowCheckout(false);
                }}
                className="p-2 hover:bg-slate-700 rounded-lg transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {cart.length === 0 ? (
              <div className="p-6 text-center">
                <ShoppingCart className="w-16 h-16 text-slate-600 mx-auto mb-4" />
                <p className="text-slate-400">Your cart is empty</p>
              </div>
            ) : (
              <>
                {!showCheckout ? (
                  <>
                    <div className="p-6 space-y-4">
                      {cart.map((item) => (
                        <div
                          key={item.id}
                          className="bg-slate-800 rounded-lg p-4 border border-slate-700"
                        >
                          <div className="flex items-start justify-between mb-2">
                            <div>
                              <h4 className="font-bold text-lg">{item.name}</h4>
                              <p className="text-slate-400 text-sm">{item.tagline}</p>
                            </div>
                            <button
                              onClick={() => removeFromCart(item.id)}
                              className="p-1 hover:bg-slate-700 rounded transition-colors"
                            >
                              <X className="w-5 h-5 text-red-400" />
                            </button>
                          </div>
                          <div className="text-xl font-bold">
                            {item.price.oneTime
                              ? formatPrice(item.price.oneTime, "oneTime")
                              : formatPrice(
                                  billingCycle === "monthly" ? item.price.monthly : item.price.annual,
                                  billingCycle === "monthly" ? "month" : "year"
                                )}
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="sticky bottom-0 bg-slate-900 border-t border-slate-700 p-6">
                      <div className="flex items-center justify-between mb-4">
                        <span className="text-xl font-bold">Total:</span>
                        <span className="text-2xl font-bold">${getCartTotal()}</span>
                      </div>
                      <button
                        onClick={() => setShowCheckout(true)}
                        className="w-full bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 text-white font-bold py-4 px-6 rounded-xl transition-all duration-300 shadow-lg hover:shadow-xl flex items-center justify-center gap-2"
                      >
                        <Shield className="w-5 h-5" />
                        Buy on eBay (Buyer Protection)
                        <ArrowRight className="w-5 h-5" />
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="p-6">
                    <button
                      onClick={() => setShowCheckout(false)}
                      className="mb-4 text-blue-400 hover:text-blue-300 flex items-center gap-2"
                    >
                      ← Back to Cart
                    </button>

                    <div className="text-center mb-6">
                      <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full mb-4">
                        <Shield className="w-8 h-8 text-white" />
                      </div>
                      <h3 className="text-2xl font-bold mb-2">Purchase via eBay</h3>
                      <p className="text-slate-400">
                        We sell via eBay for your security and buyer protection
                      </p>
                    </div>

                    {/* Trust Messaging */}
                    <div className="bg-gradient-to-r from-blue-900/50 to-purple-900/50 border border-blue-700 rounded-lg p-6 mb-6">
                      <div className="flex items-start gap-3 mb-4">
                        <Shield className="w-6 h-6 text-blue-400 flex-shrink-0 mt-0.5" />
                        <div>
                          <h4 className="font-bold text-lg mb-2">eBay Buyer Protection</h4>
                          <ul className="text-sm text-slate-300 space-y-1">
                            <li>✓ Full refund if item doesn't match description</li>
                            <li>✓ eBay Money Back Guarantee on every purchase</li>
                            <li>✓ Secure payment through eBay's trusted system</li>
                            <li>✓ Protection against fraudulent sellers</li>
                          </ul>
                        </div>
                      </div>
                    </div>

                    {/* Cart Summary */}
                    <div className="bg-slate-800 rounded-lg p-4 border border-slate-700 mb-6">
                      <h4 className="font-bold mb-3">Order Summary</h4>
                      {cart.map((item) => (
                        <div
                          key={item.id}
                          className="flex items-center justify-between py-2 border-b border-slate-700 last:border-0"
                        >
                          <div>
                            <div className="font-semibold">{item.name}</div>
                            <div className="text-sm text-slate-400">{item.tagline}</div>
                          </div>
                          <div className="font-bold">
                            {item.price.oneTime
                              ? formatPrice(item.price.oneTime, "oneTime")
                              : formatPrice(
                                  billingCycle === "monthly" ? item.price.monthly : item.price.annual,
                                  billingCycle === "monthly" ? "month" : "year"
                                )}
                          </div>
                        </div>
                      ))}
                      <div className="border-t border-slate-700 mt-4 pt-4 flex items-center justify-between">
                        <span className="text-lg font-bold">Total:</span>
                        <span className="text-xl font-bold">${getCartTotal()}</span>
                      </div>
                    </div>

                    {/* eBay Purchase Buttons */}
                    <div className="space-y-3">
                      {cart.length === 1 ? (
                        <a
                          href={cart[0].ebayUrl || EBAY_STORE_URL}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="w-full bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-bold py-4 px-6 rounded-xl transition-all duration-300 shadow-lg hover:shadow-xl flex items-center justify-center gap-2"
                        >
                          <span className="text-xl font-bold">e</span>
                          <span>Buy on eBay (Buyer Protection)</span>
                          <ArrowRight className="w-5 h-5" />
                        </a>
                      ) : (
                        <a
                          href={EBAY_STORE_URL}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="w-full bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-bold py-4 px-6 rounded-xl transition-all duration-300 shadow-lg hover:shadow-xl flex items-center justify-center gap-2"
                        >
                          <span className="text-xl font-bold">e</span>
                          <span>View Our eBay Store</span>
                          <ArrowRight className="w-5 h-5" />
                        </a>
                      )}

                      <p className="text-xs text-slate-400 text-center mt-4">
                        You'll be redirected to eBay to complete your purchase securely.
                        <br />
                        All transactions are protected by eBay's Money Back Guarantee.
                      </p>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
