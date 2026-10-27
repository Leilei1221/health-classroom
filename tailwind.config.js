import defaultTheme from 'tailwindcss/defaultTheme'

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        // 芫荽（Iansui）沒載入或缺字時，退回思源黑體再退回系統字
        sans: ['Iansui', '"Noto Sans TC"', ...defaultTheme.fontFamily.sans],
        // 教師後台：清松手寫體 1（圓潤）；字型檔沒有的字（例如「・」）與載入期間退回圓體 Huninn，再退回思源黑體
        cute: ['JasonHandwriting', 'Huninn', '"Noto Sans TC"', ...defaultTheme.fontFamily.sans],
      },
      colors: {
        // 莫蘭迪霧藍：學生端（入口頁、選位頁）的玻璃風格用
        // 教師後台的可愛貼紙風：奶油底、深色粗邊、硬邊陰影、粉彩色塊
        cute: {
          ink: '#3A3535',
          mute: '#6B6360',
          cream: '#FDF8EC',
          butter: '#FFF3C4',
          yellow: '#F8D768',
          green: '#BFE3A8',
          blue: '#A9D6EE',
          pink: '#F4B5AE',
          lavender: '#CFC1EA',
          peach: '#F9C79B',
          sand: '#F3EAD0',
        },
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
