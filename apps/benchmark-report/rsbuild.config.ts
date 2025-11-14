import { defineConfig } from '@rsbuild/core';
import { pluginReact } from '@rsbuild/plugin-react';
import { tanstackRouter } from '@tanstack/router-plugin/rspack';
import { pluginNodePolyfill } from "@rsbuild/plugin-node-polyfill";
import { resolve } from 'path';
import { withZephyr } from "zephyr-rsbuild-plugin"

export default defineConfig({
  plugins: [pluginNodePolyfill(), pluginReact(), withZephyr()],
  resolve: {
    alias: {
      '@': './src',
      '@harness': '../packages/harness/src',
      '@database': '../packages/database/src',
      '@evaluators': '../packages/evaluators/src',
      '@agent-adapters': '../packages/agent-adapters/src',
      '@db': resolve(__dirname, '../results')
    },
  },
  html: {
    template: './src/index.html',
  },
  server: {
    port: process.env.PORT ? parseInt(process.env.PORT) : 3000,
    publicDir: {
      name: 'public',
      copyOnBuild: true,
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
        return context.resourcePath.endsWith('.css') ? { plugins: [require('@tailwindcss/postcss')] } : {};
      },
    },
  },
});
