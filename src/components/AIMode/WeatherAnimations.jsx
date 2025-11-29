import React, { useMemo } from 'react';
import { motion } from 'framer-motion';

export function Sunny() {
  return (
    <motion.div
      className="ai-weather-layer"
      initial={{ opacity: 0 }}
      animate={{ opacity: 0.5 }}
      style={{ background: 'radial-gradient(circle at 50% 30%, rgba(255,255,200,0.35), rgba(255,255,255,0))' }}
    />
  );
}

export function Night() {
  const stars = useMemo(() => {
    const count = window.innerWidth < 640 ? 25 : 40;
    return Array.from({ length: count }).map(() => ({
      top: Math.random() * 100,
      left: Math.random() * 100,
      d: 2 + Math.random() * 3,
      delay: Math.random() * 4
    }));
  }, []);
  return (
    <div className="ai-weather-layer">
      {stars.map((s, i) => (
        <motion.div
          key={i}
          className="ai-star"
          initial={{ opacity: 0 }}
          animate={{ opacity: [0, 1, 0] }}
          transition={{ duration: s.d, repeat: Infinity, delay: s.delay }}
          style={{ top: `${s.top}%`, left: `${s.left}%` }}
        />
      ))}
    </div>
  );
}

export function Snowy() {
  const flakes = useMemo(() => {
    const count = window.innerWidth < 640 ? 18 : 30;
    return Array.from({ length: count }).map(() => ({
      left: Math.random() * 100,
      dur: 6 + Math.random() * 4,
      delay: Math.random() * 5
    }));
  }, []);
  return (
    <div className="ai-weather-layer">
      {flakes.map((f, i) => (
        <motion.div
          key={i}
          className="ai-snow"
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: '110%', opacity: 0.9 }}
          transition={{ duration: f.dur, repeat: Infinity, delay: f.delay }}
          style={{ left: `${f.left}%` }}
        />
      ))}
    </div>
  );
}

export function Rainy() {
  const drops = useMemo(() => {
    const count = window.innerWidth < 640 ? 30 : 50;
    return Array.from({ length: count }).map(() => ({
      left: Math.random() * 100,
      dur: 1.8 + Math.random(),
      delay: Math.random() * 1.5
    }));
  }, []);
  return (
    <div className="ai-weather-layer">
      {drops.map((d, i) => (
        <motion.div
          key={i}
          className="ai-rain"
          initial={{ y: -40, opacity: 0 }}
          animate={{ y: '110%', opacity: 0.8 }}
          transition={{ duration: d.dur, repeat: Infinity, delay: d.delay }}
          style={{ left: `${d.left}%`, width: 2, height: 14 }}
        />
      ))}
    </div>
  );
}
