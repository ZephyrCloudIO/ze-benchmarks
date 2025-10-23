import {defineConfig} from '@rsbuild/core';
import {pluginReact} from '@rsbuild/plugin-react';
// @ts-ignore
import {tanstackRouter} from '@tanstack/router-plugin/rspack';

export default defineConfig({
  plugins: [pluginReact()],
  resolve: {
    alias: {
      '@': './src',
      'results': '../../results',
    },
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
