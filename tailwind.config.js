import defaultTheme from 'tailwindcss/defaultTheme'

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        // 芫荽（Iansui）沒載入或缺字時，退回思源黑體再退回系統字
        sans: ['Iansui', '"Noto Sans TC"', ...defaultTheme.fontFamily.sans],
      },
      colors: {
        // 莫蘭迪霧藍：學生端（入口頁、選位頁）的玻璃風格用
        mist: {
          ink: '#2B3A4A',
          mute: '#44556A',
          deep: '#3B5878',
          main: '#4F6F92',
          light: '#7F9DBB',
        },
      },
    },
  },
  plugins: [],
}
