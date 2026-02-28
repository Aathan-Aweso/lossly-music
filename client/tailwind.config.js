/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/**/*.{js,jsx,ts,tsx}',
    './public/index.html'
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          400: '#38bdf8',
          500: '#0ea5e9',
          600: '#0284c7',
          700: '#0369a1'
        },
        gray: {
          900: '#121212',
          800: '#181818',
          700: '#282828',
          600: '#404040',
          500: '#606060',
          400: '#909090',
          300: '#b3b3b3',
          200: '#d3d3d3',
          100: '#f5f5f5'
        }
      },
      animation: {
        'spin-slow': 'spin 3s linear infinite'
      }
    }
  },
  plugins: []
};
