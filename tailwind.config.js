/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,jsx,ts,tsx}',
    './components/**/*.{js,jsx,ts,tsx}',
  ],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        primary: '#FF6835',
        'primary-dark': '#E84B1A',
        secondary: '#1E3A5F',
        background: '#F8F7F4',
        card: '#FFFFFF',
        muted: '#6B7280',
        'muted-fg': '#9CA3AF',
        success: '#22C55E',
        error: '#EF4444',
        warning: '#F59E0B',
        border: '#E5E7EB',
        accent: '#FEF2EC',
      },
    },
  },
  plugins: [],
};
