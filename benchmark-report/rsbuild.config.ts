import {defineConfig} from '@rsbuild/core';
import {pluginReact} from '@rsbuild/plugin-react';
// @ts-expect-error
import {tanstackRouter} from '@tanstack/router-plugin/rspack';
import {pluginNodePolyfill} from "@rsbuild/plugin-node-polyfill";

export default defineConfig({
  plugins: [pluginNodePolyfill(), pluginReact()],
  resolve: {
    alias: {
      '@': './src'
    },
  },
  output: {
    copy: [
      { from: '../node_modules/.pnpm/sql.js@1.13.0/node_modules/sql.js/dist/sql-wasm.wasm' },
      { from: '../results/benchmarks.db', to: 'benchmarks.db' }
    ]
  },
  server: {
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
        return context.resourcePath.endsWith('.css') ? {plugins: [require('@tailwindcss/postcss')]} : {};
      },
    },
  },
  dev: {
    writeToDisk: false,
  },
});
