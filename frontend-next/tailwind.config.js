/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: { extend: {
    colors: { ink: '#0a0a0c', panel: '#121216', card: '#1a1a24', line: '#292936', electric: '#3b82f6', indigo: '#6366f1' },
    boxShadow: { glow: '0 0 45px rgba(59,130,246,.13)' },
    fontFamily: { sans: ['Inter', 'Plus Jakarta Sans', 'ui-sans-serif', 'system-ui', 'sans-serif'] }
  } },
  plugins: []
};
