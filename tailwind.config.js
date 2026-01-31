/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      // Design System Colors
      colors: {
        'oms': {
          'blue': '#0000FF',      // Primary Blue - actions, links, active items
          'orange': '#FF6600',    // Accent Orange - urgent, attention
          'dark': '#3A3F4F',      // Dark Grey - structure, sidebar, primary text
          'light': '#D5D5D6',     // Light Grey - disabled, secondary areas
          'white': '#FFFFFF',     // White - main surfaces
        },
        'oms-text': {
          'primary': '#3A3F4F',   // Primary text color
          'secondary': '#6B6F7A', // Secondary text color
          'disabled': '#9AA0A6',  // Disabled text color
        }
      },

      // Typography - Design System
      fontFamily: {
        sans: ['"Google Sans"', '"Product Sans"', 'Roboto', 'Arial', 'sans-serif'],
      },
      fontSize: {
        // Design System Typography
        'page-title': ['20px', { lineHeight: '1.4', fontWeight: '600' }],  // Semibold 20px
        'section': ['16px', { lineHeight: '1.5', fontWeight: '600' }],     // Semibold 16px
        'body': ['14px', { lineHeight: '1.5', fontWeight: '400' }],        // Regular 14px
        'label': ['12px', { lineHeight: '1.4', fontWeight: '400' }],       // Regular 12px
        'button': ['14px', { lineHeight: '1.4', fontWeight: '500' }],      // Medium 14px

        // Keep existing for compatibility
        'xs': ['0.75rem', { lineHeight: '1.5' }],
        'sm': ['0.875rem', { lineHeight: '1.5' }],
        'base': ['0.875rem', { lineHeight: '1.5' }],
        'lg': ['1rem', { lineHeight: '1.5' }],
        'xl': ['1.125rem', { lineHeight: '1.4' }],
        '2xl': ['1.25rem', { lineHeight: '1.3' }],
        '3xl': ['1.5rem', { lineHeight: '1.3' }],
        '4xl': ['1.875rem', { lineHeight: '1.2' }],
      },

      // Spacing - 8px Grid System
      spacing: {
        '1': '8px',
        '2': '16px',
        '3': '24px',
        '4': '32px',
        '5': '40px',
      },
    },
  },
  plugins: [],
}

