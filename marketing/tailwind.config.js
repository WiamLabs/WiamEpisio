/** © 2026 WiamApp. Powered by WiamLabs */
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,jsx}',
    './components/**/*.{js,jsx}',
  ],
  theme: {
    extend: {
      colors: {
        navy: '#0D0D2B',
        navyMid: '#15163F',
        navySoft: '#1D1E4D',
        gold: '#D4A017',
        goldLight: '#F2C94C',
        goldTint: '#FBF3DD',
        paper: '#FAFAF8',
        ink: '#15162B',
        inkMuted: '#6B6B80',
        inkFaint: '#A0A0B2',
        line: '#E9E9EE',
        green: '#1F9D6B',
        greenTint: '#E6F6EE',
        amber: '#C9821B',
        amberTint: '#FBF0DD',
        red: '#C23B3B',
        redTint: '#FBEAEA',
        blue: '#2563A8',
        blueTint: '#E8F1FA',
      },
      fontFamily: {
        display: ['Manrope', 'sans-serif'],
        body: ['Inter', 'sans-serif'],
      },
      borderRadius: {
        card: '14px',
      },
    },
  },
  plugins: [],
};
