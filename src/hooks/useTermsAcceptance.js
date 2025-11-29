import { useState, useEffect } from 'react';

const TERMS_ACCEPTANCE_KEY = 'engineering_suite_terms_accepted';
const TERMS_VERSION = '1.0'; // Update this when you change the terms

/**
 * Hook to manage terms acceptance status
 * Stores acceptance in localStorage so users only see the modal once
 * @returns {Object} { termsAccepted, markTermsAccepted, resetTermsAcceptance }
 */
export const useTermsAcceptance = () => {
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);

  // Load acceptance status from localStorage on mount
  useEffect(() => {
    const storedAcceptance = localStorage.getItem(TERMS_ACCEPTANCE_KEY);
    const storedVersion = localStorage.getItem(`${TERMS_ACCEPTANCE_KEY}_version`);

    // If terms version changed, reset acceptance and show modal again
    if (storedVersion !== TERMS_VERSION) {
      localStorage.removeItem(TERMS_ACCEPTANCE_KEY);
      localStorage.setItem(`${TERMS_ACCEPTANCE_KEY}_version`, TERMS_VERSION);
      setTermsAccepted(false);
    } else if (storedAcceptance === 'true') {
      setTermsAccepted(true);
    }

    setIsLoaded(true);
  }, []);

  const markTermsAccepted = () => {
    localStorage.setItem(TERMS_ACCEPTANCE_KEY, 'true');
    localStorage.setItem(`${TERMS_ACCEPTANCE_KEY}_version`, TERMS_VERSION);
    setTermsAccepted(true);
  };

  const resetTermsAcceptance = () => {
    localStorage.removeItem(TERMS_ACCEPTANCE_KEY);
    localStorage.removeItem(`${TERMS_ACCEPTANCE_KEY}_version`);
    setTermsAccepted(false);
  };

  return {
    termsAccepted,
    markTermsAccepted,
    resetTermsAcceptance,
    isLoaded,
  };
};

export default useTermsAcceptance;
