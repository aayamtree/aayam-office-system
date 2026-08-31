/** @type {import('tailwindcss').Config} */
module.exports = {
	darkMode: ['class'],
	content: [
		'./pages/**/*.{js,ts,jsx,tsx,mdx}',
		'./components/**/*.{js,ts,jsx,tsx,mdx}',
		'./app/**/*.{js,ts,jsx,tsx,mdx}',
	],
	theme: {
		extend: {
			colors: {
				oms: {
					blue: '#0075DE',
					orange: '#E89D01',
					dark: '#111111',
					light: '#EBE9E6',
					white: '#FFFFFF'
				},
				'oms-text': {
					primary: '#111111',
					secondary: '#615D59',
					disabled: '#9C9792'
				},
				background: 'hsl(var(--background))',
				foreground: 'hsl(var(--foreground))',
				card: {
					DEFAULT: 'hsl(var(--card))',
					foreground: 'hsl(var(--card-foreground))'
				},
				popover: {
					DEFAULT: 'hsl(var(--popover))',
					foreground: 'hsl(var(--popover-foreground))'
				},
				primary: {
					DEFAULT: 'hsl(var(--primary))',
					foreground: 'hsl(var(--primary-foreground))'
				},
				secondary: {
					DEFAULT: 'hsl(var(--secondary))',
					foreground: 'hsl(var(--secondary-foreground))'
				},
				muted: {
					DEFAULT: 'hsl(var(--muted))',
					foreground: 'hsl(var(--muted-foreground))'
				},
				accent: {
					DEFAULT: 'hsl(var(--accent))',
					foreground: 'hsl(var(--accent-foreground))'
				},
				destructive: {
					DEFAULT: 'hsl(var(--destructive))',
					foreground: 'hsl(var(--destructive-foreground))'
				},
				border: 'hsl(var(--border))',
				input: 'hsl(var(--input))',
				ring: 'hsl(var(--ring))',
				chart: {
					'1': 'hsl(var(--chart-1))',
					'2': 'hsl(var(--chart-2))',
					'3': 'hsl(var(--chart-3))',
					'4': 'hsl(var(--chart-4))',
					'5': 'hsl(var(--chart-5))'
				}
			},
			fontFamily: {
				sans: [
					'Inter',
					'-apple-system',
					'BlinkMacSystemFont',
					'Segoe UI',
					'Roboto',
					'sans-serif'
				]
			},
			fontSize: {
				'page-title': [
					'20px',
					{
						lineHeight: '1.4',
						fontWeight: '600'
					}
				],
				section: [
					'16px',
					{
						lineHeight: '1.5',
						fontWeight: '600'
					}
				],
				body: [
					'14px',
					{
						lineHeight: '1.5',
						fontWeight: '400'
					}
				],
				label: [
					'12px',
					{
						lineHeight: '1.4',
						fontWeight: '400'
					}
				],
				button: [
					'14px',
					{
						lineHeight: '1.4',
						fontWeight: '500'
					}
				],
				xs: [
					'0.75rem',
					{
						lineHeight: '1.5'
					}
				],
				sm: [
					'0.875rem',
					{
						lineHeight: '1.5'
					}
				],
				base: [
					'0.875rem',
					{
						lineHeight: '1.5'
					}
				],
				lg: [
					'1rem',
					{
						lineHeight: '1.5'
					}
				],
				xl: [
					'1.125rem',
					{
						lineHeight: '1.4'
					}
				],
				'2xl': [
					'1.25rem',
					{
						lineHeight: '1.3'
					}
				],
				'3xl': [
					'1.5rem',
					{
						lineHeight: '1.3'
					}
				],
				'4xl': [
					'1.875rem',
					{
						lineHeight: '1.2'
					}
				]
			},
			/* spacing: default Tailwind scale (1 unit = 4px) */
			boxShadow: {
				sm: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
				DEFAULT: '0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)',
				md: '0px 4px 12px rgba(0, 0, 0, 0.1)',
				lg: 'none',
				xl: 'none',
				'2xl': 'none',
				inner: 'none',
				none: 'none'
			},
			borderRadius: {
				lg: 'var(--radius)',
				md: 'calc(var(--radius) - 2px)',
				sm: 'calc(var(--radius) - 4px)'
			},
			keyframes: {
				'slide-in-right': {
					'0%': { transform: 'translateX(100%)' },
					'100%': { transform: 'translateX(0)' },
				},
			},
			animation: {
				'slide-in-right': 'slide-in-right 0.22s cubic-bezier(0.32, 0.72, 0, 1)',
			},
			backgroundColor: {
				white: '#FFFFFF',
			}
		},
	},
	plugins: [require("tailwindcss-animate")],
}
