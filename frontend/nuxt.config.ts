// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2026-01-31',

  future: {
    compatibilityVersion: 5,
  },

  experimental: {
    nitroAutoImports: true
  },

  devServer: {
    port: 1487
  },

  devtools: {
    enabled: true
  },

  runtimeConfig: {
    // Server-side URL for backend proxy
    authServiceUrl: 'http://localhost:8787',

    public: {
      // Public config available on client
      appName: 'Passport',
    },
  },

  app: {
    head: {
      title: 'Passport — Authentication',
      meta: [
        { charset: 'utf-8' },
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
        { name: 'color-scheme', content: 'light dark' },
      ],
      htmlAttrs: {
        lang: 'en',
      },
    },
  },

  imports: {
    scan: false,
  },

  css: ['~/assets/css/main.css'],

  typescript: {
    strict: true,
    typeCheck: true,
  },
})
