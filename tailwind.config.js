/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        comic: ['"Mali"', '"Comic Sans MS"', 'sans-serif'],
      },
      boxShadow: {
        'sketch': '3px 3px 0px 0px rgba(0, 0, 0, 0.9)',
        'sketch-lg': '5px 5px 0px 0px rgba(0, 0, 0, 0.9)',
        'sketch-dark': '3px 3px 0px 0px rgba(255, 255, 255, 0.9)',
      }
    },
  },
  plugins: [],
}
