import { defineConfig } from 'vitepress';

// Pinned to VitePress 1.x deliberately: 2.0 requires Node 22+, and CI runs
// Node 20 across build.yml, release.yml and docs.yml. Revisit after that bump.
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
