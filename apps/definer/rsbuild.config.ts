import { defineConfig } from '@rsbuild/core';
// import { withZephyr } from "zephyr-rsbuild-plugin";
import { pluginReact } from '@rsbuild/plugin-react';

// Docs: https://rsbuild.rs/config/
export default defineConfig({
  plugins: [pluginReact()]
});