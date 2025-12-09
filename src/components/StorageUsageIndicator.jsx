import React, { useState, useEffect } from 'react';
import { Database, AlertTriangle } from 'lucide-react';

/**
 * StorageUsageIndicator Component
 * Shows approximate localStorage usage and quota information
 */
export default function StorageUsageIndicator() {
  const [storageInfo, setStorageInfo] = useState({
    used: 0,
    quota: 0,
    usagePercent: 0,
    estimate: 'Unknown'
  });

  useEffect(() => {
    const calculateStorage = () => {
      try {
        // Estimate localStorage usage by summing all keys
        let totalSize = 0;
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key) {
            const value = localStorage.getItem(key);
            // Rough estimate: key length + value length (in bytes, assuming UTF-16 = 2 bytes per char)
            totalSize += (key.length + (value ? value.length : 0)) * 2;
          }
        }

        // Get quota if available (Chrome/Edge)
        let quota = 0;
        let usage = 0;
        
        if ('storage' in navigator && 'estimate' in navigator.storage) {
          navigator.storage.estimate().then((estimate) => {
            quota = estimate.quota || 0;
            usage = estimate.usage || 0;
            const usagePercent = quota > 0 ? (usage / quota) * 100 : 0;
            
            setStorageInfo({
              used: usage,
              quota: quota,
              usagePercent: usagePercent,
              estimate: formatBytes(usage)
            });
          }).catch(() => {
            // Fallback to localStorage estimate
            setStorageInfo({
              used: totalSize,
              quota: 5 * 1024 * 1024, // Assume 5MB default quota
              usagePercent: (totalSize / (5 * 1024 * 1024)) * 100,
              estimate: formatBytes(totalSize)
            });
          });
        } else {
          // Fallback: use localStorage estimate with assumed 5MB quota
          const assumedQuota = 5 * 1024 * 1024; // 5MB
          setStorageInfo({
            used: totalSize,
            quota: assumedQuota,
            usagePercent: (totalSize / assumedQuota) * 100,
            estimate: formatBytes(totalSize)
          });
        }
      } catch (error) {
        console.warn('Failed to calculate storage usage:', error);
        setStorageInfo({
          used: 0,
          quota: 0,
          usagePercent: 0,
          estimate: 'Unable to calculate'
        });
      }
    };

    calculateStorage();
    
    // Recalculate when storage changes
    const handleStorageChange = () => {
      calculateStorage();
    };
    
    window.addEventListener('storage', handleStorageChange);
    // Also listen for custom storage events (same-tab updates)
    window.addEventListener('localStorageUpdated', handleStorageChange);
    
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('localStorageUpdated', handleStorageChange);
    };
  }, []);

  const formatBytes = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  };

  const getColorClass = () => {
    if (storageInfo.usagePercent >= 90) return 'text-red-600 dark:text-red-400';
    if (storageInfo.usagePercent >= 75) return 'text-orange-600 dark:text-orange-400';
    if (storageInfo.usagePercent >= 50) return 'text-yellow-600 dark:text-yellow-400';
    return 'text-green-600 dark:text-green-400';
  };

  return (
    <div className="bg-blue-50 dark:bg-blue-900/20 border-2 border-blue-200 dark:border-blue-800 rounded-lg p-4">
      <div className="flex items-center gap-2 mb-3">
        <Database className="w-5 h-5 text-blue-600 dark:text-blue-400" />
        <h3 className="font-semibold text-blue-900 dark:text-blue-200">
          Storage Usage
        </h3>
      </div>
      
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="text-blue-800 dark:text-blue-300">Estimated Usage:</span>
          <span className={`font-semibold ${getColorClass()}`}>
            {storageInfo.estimate}
          </span>
        </div>
        
        {storageInfo.quota > 0 && (
          <>
            <div className="w-full bg-blue-200 dark:bg-blue-800 rounded-full h-2.5">
              <div
                className={`h-2.5 rounded-full transition-all ${
                  storageInfo.usagePercent >= 90
                    ? 'bg-red-500'
                    : storageInfo.usagePercent >= 75
                    ? 'bg-orange-500'
                    : storageInfo.usagePercent >= 50
                    ? 'bg-yellow-500'
                    : 'bg-green-500'
                }`}
                style={{ width: `${Math.min(storageInfo.usagePercent, 100)}%` }}
              />
            </div>
            
            <div className="flex items-center justify-between text-xs text-blue-700 dark:text-blue-400">
              <span>{Math.round(storageInfo.usagePercent)}% used</span>
              <span>{formatBytes(storageInfo.quota)} available</span>
            </div>
          </>
        )}
        
        {storageInfo.usagePercent >= 90 && (
          <div className="flex items-start gap-2 mt-3 p-2 bg-red-50 dark:bg-red-900/30 rounded border border-red-200 dark:border-red-700">
            <AlertTriangle className="w-4 h-4 text-red-600 dark:text-red-400 mt-0.5 flex-shrink-0" />
            <p className="text-xs text-red-800 dark:text-red-200">
              Storage is nearly full. Consider clearing old data or deleting unused analyses.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}


