/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
        "./*.{js,ts,jsx,tsx}", // For files in root like App.tsx
        "./components/**/*.{js,ts,jsx,tsx}" // For components in root/components
    ],
    theme: {
        extend: {
            colors: {
                aera: {
                    50: '#ecfdf5',
                    100: '#d1fae5',
                    200: '#a7f3d0',
                    300: '#6ee7b7',
                    400: '#34d399',
                    500: '#10b981',
                    600: '#059669',
                    700: '#047857',
                    800: '#065f46',
                    900: '#064e3b',
                    950: '#022c22',
                },
                primary: {
                    DEFAULT: '#064e3b', // Emerald 900
                    light: '#047857',
                    dark: '#022c22'
                },
                accent: {
                    DEFAULT: '#f59e0b', // Amber 500 for a pop of color
                    hover: '#d97706'
                }
            },
            fontFamily: {
                sans: ['Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'Helvetica Neue', 'Arial', 'sans-serif'],
            },
        },
    },
    plugins: [],
}
