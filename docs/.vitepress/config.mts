import { defineConfig } from 'vitepress';

// VitePress 2 (alpha, pinned exactly in package.json) so the docs toolchain
// shares the Vite 8 that vitest already uses. 1.x pinned Vite 5, which carried
// four Dependabot alerts Dependabot itself could not resolve (#319).
export default defineConfig({
  title: 'Weather Alerts Card',
  description:
    'A custom Home Assistant Lovelace card for weather alerts — multi-provider, severity-aware, with progress bars and expandable details.',

  // Project Pages serve under the repository name. Without this every asset
  // and internal link 404s on the deployed site.
  base: '/weather_alerts_card/',

  lastUpdated: true,
  cleanUrls: false,

  head: [
    ['meta', { name: 'theme-color', content: '#03a9f4' }],
  ],

  themeConfig: {
    nav: [
      { text: 'Getting Started', link: '/getting-started' },
      { text: 'Configuration', link: '/configuration' },
      { text: 'Providers', link: '/providers' },
      { text: 'Recipes', link: '/recipes/detail-popup' },
    ],

    sidebar: [
      {
        text: 'Guide',
        items: [
          { text: 'Overview', link: '/' },
          { text: 'Getting Started', link: '/getting-started' },
          { text: 'Configuration', link: '/configuration' },
          { text: 'Theming', link: '/theming' },
          { text: 'Providers', link: '/providers' },
        ],
      },
      {
        text: 'Recipes',
        items: [
          { text: 'Per-alert detail pop-up', link: '/recipes/detail-popup' },
          { text: 'Bubble Card pop-up', link: '/recipes/bubble-card-popup' },
          { text: 'Alert text in your own language', link: '/recipes/alert-language' },
        ],
      },
      {
        text: 'Contributing',
        items: [{ text: 'Development', link: '/development' }],
      },
    ],

    socialLinks: [
      { icon: 'github', link: 'https://github.com/seevee/weather_alerts_card' },
    ],

    search: { provider: 'local' },

    editLink: {
      pattern: 'https://github.com/seevee/weather_alerts_card/edit/main/docs/:path',
      text: 'Edit this page on GitHub',
    },

    footer: {
      message: 'Released under the MIT License.',
      copyright: 'Not affiliated with, or endorsed by, any weather agency.',
    },
  },
});
