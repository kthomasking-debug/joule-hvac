import { useEffect, useState } from 'react';

const AnimatedSplash = ({ onComplete }) => {
  const [progress, setProgress] = useState(0);
  const [phase, setPhase] = useState('animating'); // 'animating' or 'branding'

  useEffect(() => {
    // Animation phase: 0 to 100 over 2 seconds
    const duration = 2000;
    const startTime = Date.now();
    
    const animate = () => {
      const elapsed = Date.now() - startTime;
      const newProgress = Math.min((elapsed / duration) * 100, 100);
      
      setProgress(newProgress);
      
      if (newProgress < 100) {
        requestAnimationFrame(animate);
      } else {
        // Switch to branding phase
        setTimeout(() => {
          setPhase('branding');
          // Complete after branding shows for 800ms (optional callback)
          setTimeout(() => {
            if (typeof onComplete === 'function') {
              onComplete();
            }
          }, 800);
        }, 300);
      }
    };
    
    requestAnimationFrame(animate);
  }, [onComplete]);

  // Interpolate values based on progress
  const temperature = 65 + (progress / 100) * 8; // 65°F to 73°F
  const cost = 8.50 + (progress / 100) * 5.75; // $8.50 to $14.25
  
  // Dot position (10% to 90% of screen width)
  const dotPosition = 10 + (progress / 100) * 80;

  if (phase === 'branding') {
    return (
      <div className="fixed inset-0 bg-gradient-to-br from-slate-900 via-slate-800 to-blue-900 flex items-center justify-center z-50 animate-fadeIn">
        <div className="text-center">
          <div className="text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-400 mb-2">
            Joule
          </div>
          <div className="text-xl text-blue-300 font-light">
            Your Home Energy, Measured
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-gradient-to-br from-slate-900 via-slate-800 to-blue-900 flex items-center justify-center z-50">
      <div className="w-full max-w-md px-8">
        {/* Temperature value (above) */}
        <div 
          className="text-center mb-8 transition-opacity duration-300"
          style={{ 
            opacity: progress > 5 ? 1 : 0,
            transform: `translateX(${dotPosition - 50}%)`,
          }}
        >
          <div className="text-4xl font-bold text-orange-400">
            {temperature.toFixed(1)}°F
          </div>
          <div className="text-sm text-orange-300 mt-1">Temperature</div>
        </div>

        {/* Slider track and dot */}
        <div className="relative h-2 bg-slate-700/50 rounded-full mb-8">
          {/* Progress track */}
          <div 
            className="absolute left-0 top-0 h-full bg-gradient-to-r from-blue-500 to-cyan-400 rounded-full transition-all duration-100"
            style={{ width: `${progress}%` }}
          />
          
          {/* Animated dot */}
          <div 
            className="absolute top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-gradient-to-br from-blue-400 to-cyan-300 shadow-lg shadow-blue-500/50 transition-all duration-100"
            style={{ 
              left: `${dotPosition}%`,
              transform: 'translate(-50%, -50%)',
            }}
          >
            {/* Pulse effect */}
            <div className="absolute inset-0 rounded-full bg-blue-400 animate-ping opacity-75" />
          </div>
        </div>

        {/* Cost value (below) */}
        <div 
          className="text-center transition-opacity duration-300"
          style={{ 
            opacity: progress > 5 ? 1 : 0,
            transform: `translateX(${dotPosition - 50}%)`,
          }}
        >
          <div className="text-4xl font-bold text-green-400">
            ${cost.toFixed(2)}
          </div>
          <div className="text-sm text-green-300 mt-1">Daily Cost</div>
        </div>

        {/* Subtle tagline that fades in near the end */}
        <div 
          className="text-center mt-12 text-blue-300/70 text-sm transition-opacity duration-500"
          style={{ opacity: progress > 70 ? 1 : 0 }}
        >
          Smart choices, lower costs
        </div>
      </div>
    </div>
  );
};

export default AnimatedSplash;
