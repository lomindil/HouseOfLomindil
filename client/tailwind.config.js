/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        parchment: { 50: '#fdf6e3', 100: '#f8ead0', 200: '#edd9a3', 300: '#dfc07a', 400: '#c9a24c' },
        tavern: {
          bg: '#0d0805',
          card: '#1a0f0a',
          border: '#4a2f1a',
          gold: '#c9962a',
          'gold-light': '#e8c040',
          red: '#8b1a1a',
          'red-light': '#c02020',
          text: '#e8d5b7',
          muted: '#9a7c5c',
        },
      },
      fontFamily: {
        serif: ['"Cinzel"', '"Palatino Linotype"', 'Georgia', 'serif'],
        body: ['"Lato"', 'sans-serif'],
      },
      backgroundImage: {
        'parchment-texture': "url('/textures/parchment.png')",
        'dark-wood': "url('/textures/wood.png')",
      },
    },
  },
  plugins: [],
};
