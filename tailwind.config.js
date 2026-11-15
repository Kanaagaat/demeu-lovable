/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: '#6755B2', lilac: '#CBBFF5', mist: '#F5F1FF', sage: '#9DB8A0',
        peach: '#F7D6C7', cream: '#FFF8F1', honey: '#FFC97A', bg: '#FFFCF9',
        ink: '#2E2A3B', muted: '#6E6880', line: '#EEE9F7', desktop: '#F2EEF8',
        'brand-hover': '#5A499F', 'brand-dark': '#4F3F96', 'icon-muted': '#8A849A',
        'line-strong': '#E6E0F5', 'line-soft': '#F3EFF9', 'tab-line': '#F0EBF8',
        surface: '#F4F2F7', success: '#4F7454', 'success-bg': '#EAF2EB',
        danger: '#A6463A', 'danger-bg': '#FCEBE8', 'danger-line': '#F3C9C1',
        'honey-soft': '#FFF1D9', 'lilac-soft': '#ECE6FF', 'sage-soft': '#E4EFE5',
        'peach-soft': '#FBE6DA', disabled: '#B3AEC0', ring: '#CFC8E0',
      },
      fontFamily: { sans: ['Nunito', 'sans-serif'] },
      borderRadius: { button: '16px', card: '22px', sheet: '28px' },
      boxShadow: {
        card: '0 4px 16px rgba(103,85,178,0.08)',
        back: '0 4px 16px rgba(103,85,178,0.10)',
        phone: '0 30px 80px rgba(46,42,59,0.22)',
        toast: '0 10px 30px rgba(46,42,59,0.30)',
      },
    },
  },
  plugins: [],
};
