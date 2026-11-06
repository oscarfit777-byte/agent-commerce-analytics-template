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
        oscar: {
          bg: '#000000',
          card: '#0A0A0A',
          cardHover: '#121212',
          border: '#1F1F1F',
          neon: '#00FF66',
          neonGlow: '#00FF6640',
          neonDark: '#00CC52',
          textMuted: '#A0A0A0',
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        display: ['Impact', 'Trebuchet MS', 'sans-serif']
      },
      boxShadow: {
        'neon': '0 0 20px -2px rgba(0, 255, 102, 0.45)',
        'neon-lg': '0 0 35px -2px rgba(0, 255, 102, 0.6)',
      }
    },
  },
  plugins: [],
}
