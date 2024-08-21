/** @type {import('tailwindcss').Config} */
const colors = require('tailwindcss/colors')

module.exports = {
  content: ["./views/**/*.ejs"],
  theme: {
    colors: {
      transparent: 'transparent',
      current: 'currentColor',
      'white': '#ffffff',
      'green': colors.green,
      'blue': colors.blue, 
      'yellow': colors.yellow, 
      'red': colors.red,
      'bluey': {
        100: '#B1AFBE',
        200: '#B1AFBE',
        300: '#B1AFBE',
        400: '#B1AFBE',
        500: '#404246',
        600: '#404246',
        700: '#323337',
        800: '#1e1f23',
        900: '#1e1f23'
      },
    },
    extend: {},
  },
  plugins: [
    require('@tailwindcss/forms'),
  ],
}