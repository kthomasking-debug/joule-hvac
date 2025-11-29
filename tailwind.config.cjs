/** Minimal Tailwind config to provide a non-empty `content` option.
 *  This will silence the `content option ... is missing or empty` warning.
 *  If you don't use Tailwind, this file is harmless. If you do, you can
 *  expand the `content` globs and add `theme`/`plugins` as needed.
 */

module.exports = {
  darkMode: 'class',
  content: [
    './index.html',
    './src/**/*.{js,jsx,ts,tsx,html}'
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'Avenir', 'Helvetica', 'Arial', 'sans-serif']
      },
      colors: {
        brand: {
          50: '#f0f7ff',
          100: '#d9ecff',
          200: '#b9ddff',
          300: '#89c9ff',
          400: '#56b0ff',
          500: '#2d95f5',
          600: '#1478d8',
          700: '#0d5faa',
          800: '#0f4d82',
          900: '#0f3d63'
        }
      },
      boxShadow: {
        'soft': '0 4px 12px rgba(0,0,0,0.06)',
        'elevated': '0 8px 24px rgba(0,0,0,0.12)'
      },
      animation: {
        'fade-in': 'fadeIn 0.4s ease',
        'slide-up': 'slideUp 0.45s ease'
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: 0 },
          '100%': { opacity: 1 }
        },
        slideUp: {
          '0%': { opacity: 0, transform: 'translateY(12px)' },
          '100%': { opacity: 1, transform: 'translateY(0)' }
        }
      }
    },
  },
  plugins: [],
};
