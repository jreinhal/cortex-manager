import colors from 'tailwindcss/colors';

const steel = {
  50: '#f3f6fb',
  100: '#e1e7f0',
  200: '#c3cedd',
  300: '#9fadc5',
  400: '#7f93af',
  500: '#6b7c94',
  600: '#5b6b81',
  700: '#4a566a',
  800: '#384252',
  900: '#283241',
  950: '#171d27',
};

const indigo = {
  50: '#f2f4f9',
  100: '#e0e6f2',
  200: '#c2cde3',
  300: '#9aaacb',
  400: '#7b8fb5',
  500: '#63749c',
  600: '#546282',
  700: '#45506a',
  800: '#353d52',
  900: '#262c3a',
  950: '#171a24',
};

const green = {
  50: '#f2f6f4',
  100: '#d9e7e0',
  200: '#b7d1c2',
  300: '#8eb59b',
  400: '#6e9a7f',
  500: '#4f7d65',
  600: '#416752',
  700: '#345344',
  800: '#2a4136',
  900: '#22362e',
  950: '#151f1a',
};

const gold = {
  50: '#faf6f0',
  100: '#f1e3c7',
  200: '#dcc191',
  300: '#c69f63',
  400: '#b38842',
  500: '#c08a3b',
  600: '#9f7331',
  700: '#7f5b26',
  800: '#62461d',
  900: '#4b3617',
  950: '#2b1f0f',
};

const red = {
  50: '#fbf3f3',
  100: '#f3d6d6',
  200: '#e2b1b1',
  300: '#cf8585',
  400: '#b55e5e',
  500: '#c45b5b',
  600: '#a04a4a',
  700: '#7f3a3a',
  800: '#632d2d',
  900: '#4b2323',
  950: '#2b1414',
};

/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    colors: {
      ...colors,
      cyan: steel,
      sky: steel,
      blue: steel,
      emerald: green,
      green,
      amber: gold,
      yellow: gold,
      purple: indigo,
      violet: indigo,
      red,
    },
    extend: {},
  },
  plugins: [],
};
