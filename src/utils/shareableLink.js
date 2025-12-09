/**
 * Shareable Link Utility
 * Creates shareable links for analysis results that can be encoded in URL parameters
 */

/**
 * Encode analysis result data into a shareable URL
 * 
 * @param {Object} result - Analysis result object
 * @param {string} baseUrl - Base URL for the app (defaults to current origin)
 * @returns {string} Shareable URL with encoded data
 */
export function createShareableLink(result, baseUrl = window.location.origin) {
  try {
    // Compress the data by only including essential fields
    const shareableData = {
      hlf: result.heatLossFactor?.toFixed(2), // Heat Loss Factor
      bp: result.balancePoint != null && isFinite(result.balancePoint) 
        ? result.balancePoint.toFixed(1) 
        : null, // Balance Point
      td: result.tempDiff?.toFixed(1), // Temperature Difference
      d: result.date || (result.timestamp ? new Date(result.timestamp).toISOString().split('T')[0] : null), // Date
      l: result.label || null, // Label
    };

    // Remove null/undefined values
    Object.keys(shareableData).forEach(key => {
      if (shareableData[key] === null || shareableData[key] === undefined) {
        delete shareableData[key];
      }
    });

    // Encode as base64 URL-safe string
    const jsonString = JSON.stringify(shareableData);
    const encoded = btoa(jsonString)
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');

    return `${baseUrl}/analysis/analyzer?share=${encoded}`;
  } catch (error) {
    console.error('Error creating shareable link:', error);
    return null;
  }
}

/**
 * Decode shareable link data from URL parameters
 * 
 * @param {string} encoded - Encoded data from URL parameter
 * @returns {Object|null} Decoded analysis result data or null if invalid
 */
export function decodeShareableLink(encoded) {
  try {
    // Decode base64 URL-safe string
    const base64 = encoded
      .replace(/-/g, '+')
      .replace(/_/g, '/');
    
    // Add padding if needed
    const padding = base64.length % 4;
    const padded = padding ? base64 + '='.repeat(4 - padding) : base64;
    
    const jsonString = atob(padded);
    const data = JSON.parse(jsonString);

    // Reconstruct result object
    return {
      heatLossFactor: data.hlf ? parseFloat(data.hlf) : null,
      balancePoint: data.bp ? parseFloat(data.bp) : null,
      tempDiff: data.td ? parseFloat(data.td) : null,
      date: data.d || null,
      label: data.l || null,
      shared: true, // Flag to indicate this is shared data
    };
  } catch (error) {
    console.error('Error decoding shareable link:', error);
    return null;
  }
}

/**
 * Check if current URL contains a share parameter and decode it
 * 
 * @returns {Object|null} Decoded share data or null
 */
export function getSharedDataFromURL() {
  const urlParams = new URLSearchParams(window.location.search);
  const shareParam = urlParams.get('share');
  
  if (shareParam) {
    return decodeShareableLink(shareParam);
  }
  
  return null;
}






