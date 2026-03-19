// @ts-check
import { defineConfig } from 'astro/config';

import sitemap from '@astrojs/sitemap';

// https://astro.build/config
export default defineConfig({
  output: 'static',
  site: 'https://www.stnicholaschurch.org.nz',
  integrations: [sitemap()],
  redirects: {
    '/gallery': '/icon-gallery',
    '/contact-us': '/contact',
    '/history': '/',
    '/sample-page': '/',
  },
});
