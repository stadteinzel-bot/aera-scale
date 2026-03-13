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
                // ── AERA SCALE Design System ──
                // Forest Green (sidebar, buttons, primary)
                aera: {
                    50:  '#eef7f2',
                    100: '#d4ecdd',
                    200: '#a9d9bb',
                    300: '#73bf93',
                    400: '#4CAF7D',
                    500: '#2d8a5e',
                    600: '#1d6644',
                    700: '#1A4A2E',
                    800: '#133820',
                    900: '#0D2818',  // PRIMARY: sidebar bg, buttons
                    950: '#071610',
                },
                // Gold (accent, active states, CTA borders)
                gold: {
                    300: '#F0D98A',
                    400: '#E8C97A',
                    500: '#C9A84C',  // PRIMARY GOLD
                    600: '#A8882C',
                    700: '#7D6320',
                },
                // Cream (main content background)
                cream: {
                    50:  '#FDFBF7',
                    100: '#F5F0E8',  // PRIMARY BG
                    200: '#EDE8DF',
                    300: '#E0D8CC',
                },
            },
            fontFamily: {
                sans: ['Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Helvetica Neue', 'Arial', 'sans-serif'],
            },
            boxShadow: {
                'card':    '0 1px 3px 0 rgb(0 0 0 / 0.06), 0 1px 2px -1px rgb(0 0 0 / 0.04)',
                'card-md': '0 4px 12px 0 rgb(0 0 0 / 0.08)',
                'gold':    '0 0 0 3px rgb(201 168 76 / 0.2)',
            },
        },
    },
    plugins: [],
}
