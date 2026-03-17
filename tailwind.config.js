/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
        "./*.{js,ts,jsx,tsx}",
        "./components/**/*.{js,ts,jsx,tsx}"
    ],
    theme: {
        extend: {
            colors: {
                aera: {
                    DEFAULT: '#2D4A3E',
                    50:  '#F0F5F2',
                    100: '#D9EAE0',
                    200: '#B2D4C1',
                    300: '#7FB8A0',
                    400: '#4E9A7E',
                    500: '#2D7D62',
                    600: '#2D4A3E',   // primary brand — matches forest.DEFAULT
                    700: '#1E3A31',
                    800: '#162D26',
                    900: '#0F1F1A',
                    950: '#081410',
                },
                cream: {
                    DEFAULT: '#F5F0E8',   // Root Background
                    dark:    '#EDE8DF',   // Hover States, Borders
                    deeper:  '#E4DDD2',   // Cards on Cream
                },
                forest: {
                    DEFAULT: '#2D4A3E',   // Primary Brand / Sidebar
                    light:   '#3D6B59',   // Hover States, Links
                    dark:    '#1E3329',   // Pressed States
                },
                gold: {
                    DEFAULT: '#C9A84C',   // Accent / CTAs / Active Icons
                    light:   '#E2C47A',   // Hover Highlights
                    dark:    '#A6883A',   // Pressed Gold
                },
                // Semantic text colors
                'text-primary':   '#1A2E25',
                'text-secondary': '#4A6358',
                'text-muted':     '#7A9589',
                // Status
                success: '#3D7A5A',
                warning: '#C9883A',
                danger:  '#C94A3A',
            },
            fontFamily: {
                display: ['"Cormorant Garamond"', 'serif'],
                body:    ['"DM Sans"', 'sans-serif'],
                mono:    ['"JetBrains Mono"', 'monospace'],
                sans:    ['"DM Sans"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
            },
            boxShadow: {
                'soft':       '0 1px 3px rgba(45,74,62,0.08), 0 1px 2px rgba(45,74,62,0.04)',
                'medium':     '0 4px 16px rgba(45,74,62,0.12), 0 2px 4px rgba(45,74,62,0.06)',
                'strong':     '0 12px 40px rgba(45,74,62,0.16), 0 4px 8px rgba(45,74,62,0.08)',
                'gold-focus': '0 0 0 3px rgba(201,168,76,0.3)',
                'gold-glow':  '0 8px 28px rgba(201,168,76,0.35)',
            },
            borderRadius: {
                'btn':  '12px',
                'card': '16px',
                'input':'8px',
            },
        },
    },
    plugins: [],
}
