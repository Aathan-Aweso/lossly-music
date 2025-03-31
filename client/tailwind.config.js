/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
    "./public/index.html"
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          400: '#a78bfa',
          500: '#8b5cf6',
          600: '#7c3aed',
          700: '#6d28d9'
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
        },
        purple: {
          500: '#9333ea',
          600: '#7e22ce'
        }
      },
      animation: {
        'spin-slow': 'spin 3s linear infinite',
      },
    },
  },
  plugins: []
}; 