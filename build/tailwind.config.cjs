module.exports = {
  content: ['../public/index.html', '../public/zh/**/*.html', '../public/ja/**/*.html', '../public/privacy/**/*.html', '../public/about/**/*.html', '../public/contact/**/*.html', '../public/blog/**/*.html', '../src/main.js'],
  theme: {
    extend: {
      colors: { obsidian: '#070A11', void: '#0B0F19', emerald: '#10B981', indigo: '#6366F1', cyan: '#06B6D4' },
      fontFamily: {
        sans: ['Inter', 'system-ui', '"PingFang SC"', '"Microsoft YaHei"', '"Hiragino Sans"', '"Yu Gothic"', 'sans-serif'],
        display: ['"Space Grotesk"', 'Inter', 'system-ui', '"PingFang SC"', '"Microsoft YaHei"', '"Hiragino Sans"', '"Yu Gothic"', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'Consolas', '"PingFang SC"', '"Microsoft YaHei"', 'monospace'],
      },
      boxShadow: { emerald: '0 0 50px rgba(16,185,129,.16)', indigo: '0 0 60px rgba(99,102,241,.18)' },
    },
  },
  plugins: [],
};
