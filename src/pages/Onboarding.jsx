import React, { useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import SevenDayCostForecaster from './SevenDayCostForecaster';

const Onboarding = () => {
  const context = useOutletContext();
  
  // Force the SevenDayCostForecaster to show onboarding mode
  useEffect(() => {
    // Clear the completion flag so onboarding shows
    localStorage.removeItem('hasCompletedOnboarding');
  }, []);

  return <SevenDayCostForecaster {...context} />;
};

export default Onboarding;
