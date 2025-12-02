import { defineConfig } from '@rsbuild/core';
import { pluginReact } from '@rsbuild/plugin-react';
import { tanstackRouter } from '@tanstack/router-plugin/rspack';
import { pluginNodePolyfill } from "@rsbuild/plugin-node-polyfill";
import { withZephyr } from "zephyr-rsbuild-plugin"
import tailwindcssPlugin from '@tailwindcss/postcss';

export default defineConfig({
  plugins: [pluginNodePolyfill(), pluginReact(), withZephyr()],
  resolve: {
    alias: {
      '@': './src',
    },
  },
  html: {
    template: './src/index.html',
  },
  server: {
    port: process.env.PORT ? parseInt(process.env.PORT) : 5173,
    publicDir: {
      name: 'public',
    },
  },
  tools: {
    rspack: {
      plugins: [
        tanstackRouter({
          target: 'react',
          autoCodeSplitting: false,
        }),
      ],
    },
    postcss: {
      postcssOptions: (context) => {
        return context.resourcePath.endsWith('.css') ? { plugins: [tailwindcssPlugin] } : {};
      },
    },
  },
});
