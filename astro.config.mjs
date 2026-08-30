import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://askdkc.github.io',
  trailingSlash: 'never',
  build: {
    format: 'preserve'
  },
  markdown: {
    shikiConfig: {
      themes: {
        light: 'github-light',
        dark: 'github-dark'
      }
    }
  }
});
