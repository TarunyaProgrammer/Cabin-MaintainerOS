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
        darkBg: '#09090b',         // Premium dark background (Linear/Raycast inspired)
        darkSurface: '#18181b',    // Card/component surface background
        darkBorder: '#27272a',     // Subtle border color
        darkMuted: '#71717a',      // Muted text color
        brandPrimary: '#3f3f46',   // Neutral primary
        brandAccent: '#f4f4f5',    // Accent color for active elements
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
