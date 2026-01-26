/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./{src,pages,contexts,hooks}/**/*.{js,ts,jsx,tsx}",
    "./*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'selector',
  theme: {
    extend: {
      borderRadius: {
        'none': '0',
        'sm': '0',
        DEFAULT: '0',
        'md': '0',
        'lg': '0',
        'xl': '0',
        '2xl': '0',
        '3xl': '0',
        'full': '0',
      },
      colors: {
        brand: {
          50: '#f0f4ff',
          100: '#e1e9ff',
          200: '#c3d3ff',
          300: '#a5bdff',
          400: '#87a7ff',
          500: '#3b82f6', // Main Primary
          600: '#2563eb',
          700: '#1d4ed8',
          800: '#1e40af',
          900: '#1e3a8a',
        },
      },
      fontFamily: {
        sans: ['Plus Jakarta Sans', 'sans-serif'],
        heading: ['Outfit', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
