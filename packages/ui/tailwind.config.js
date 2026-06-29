/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        appBg: '#f8fafc',         // Premium soft background
        appSurface: '#ffffff',    // Crisp white cards
        appBorder: '#f1f5f9',     // Very light gray border (slate-100)
        brandGreen: '#0f766e',    // Vibrant forest green (teal-700)
        brandGreenHover: '#115e59', // Darker green for hovers (teal-800)
        brandGreenLight: '#f0fdf4', // Light green highlight (emerald-50)
        brandOrange: '#f97316',   // Warning orange
        brandOrangeLight: '#fff7ed', // Warning light highlight
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
