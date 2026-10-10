/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                primary: '#3b82f6', // Màu xanh chủ đạo hợp với thiết kế Figma
            }
        },
    },
    plugins: [],
}