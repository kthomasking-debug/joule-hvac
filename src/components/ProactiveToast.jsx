// src/components/ProactiveToast.jsx
// Contextual notification system with voice prompts

import React, { useState, useEffect, useCallback } from 'react';
import { X, MessageCircle, TrendingUp, AlertTriangle, Lightbulb } from 'lucide-react';

const TOAST_ICONS = {
  suggestion: Lightbulb,
  alert: AlertTriangle,
  achievement: TrendingUp,
  chat: MessageCircle,
};

export default function ProactiveToast({ 
  notification = null,
  onDismiss,
  onAction,
  autoHideDuration = 10000 
}) {
  const [isVisible, setIsVisible] = useState(false);

  const handleDismiss = useCallback(() => {
    setIsVisible(false);
    setTimeout(() => {
      if (onDismiss) onDismiss();
    }, 300);
  }, [onDismiss]);

  useEffect(() => {
    if (notification) {
      setIsVisible(true);
      
      if (autoHideDuration > 0) {
        const timer = setTimeout(() => {
          handleDismiss();
        }, autoHideDuration);
        
        return () => clearTimeout(timer);
      }
    } else {
      setIsVisible(false);
    }
  }, [notification, autoHideDuration, handleDismiss]);

  const handleAction = () => {
    if (onAction && notification.action) {
      onAction(notification.action);
    }
    handleDismiss();
  };

  if (!notification) return null;

  const Icon = TOAST_ICONS[notification.type] || MessageCircle;
  const colorClasses = {
    suggestion: 'bg-blue-600 border-blue-400',
    alert: 'bg-orange-600 border-orange-400',
    achievement: 'bg-green-600 border-green-400',
    chat: 'bg-purple-600 border-purple-400',
  };

  return (
    <div 
      className={`fixed top-20 right-4 z-40 max-w-sm transition-all duration-300 ${
        isVisible ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-full pointer-events-none'
      }`}
    >
      <div className={`${colorClasses[notification.type] || colorClasses.chat} text-white p-4 rounded-xl shadow-xl border-2`}>
        <div className="flex items-start gap-3">
          {/* Joule avatar bubble */}
          <div className="flex-shrink-0">
            <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
              <Icon size={20} />
            </div>
          </div>

          <div className="flex-1">
            <p className="font-medium text-sm leading-relaxed">
              {notification.message}
            </p>
            
            {notification.actionLabel && (
              <button
                onClick={handleAction}
                className="mt-2 px-3 py-1 bg-white/20 hover:bg-white/30 rounded-lg text-xs font-semibold transition-colors"
              >
                {notification.actionLabel}
              </button>
            )}
          </div>

          <button
            onClick={handleDismiss}
            className="flex-shrink-0 text-white/70 hover:text-white transition-colors"
            aria-label="Dismiss"
          >
            <X size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
