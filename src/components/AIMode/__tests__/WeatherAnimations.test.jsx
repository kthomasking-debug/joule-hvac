import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { Sunny, Night, Snowy, Rainy } from '../WeatherAnimations';

describe('WeatherAnimations', () => {
  it('renders Sunny without crashing', () => {
    const { container } = render(<Sunny />);
    expect(container.querySelector('.ai-weather-layer')).toBeTruthy();
  });

  it('renders Night with stars', () => {
    const { container } = render(<Night />);
    expect(container.querySelector('.ai-weather-layer')).toBeTruthy();
    expect(container.querySelectorAll('.ai-star').length).toBeGreaterThan(0);
  });

  it('renders Snowy with snowflakes', () => {
    const { container } = render(<Snowy />);
    expect(container.querySelector('.ai-weather-layer')).toBeTruthy();
    expect(container.querySelectorAll('.ai-snow').length).toBeGreaterThan(0);
  });

  it('renders Rainy with rain drops', () => {
    const { container } = render(<Rainy />);
    expect(container.querySelector('.ai-weather-layer')).toBeTruthy();
    expect(container.querySelectorAll('.ai-rain').length).toBeGreaterThan(0);
  });
});
