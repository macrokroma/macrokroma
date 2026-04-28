import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import mdx from "@mdx-js/rollup";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    // MDX must come before React so JSX in .mdx files is handled correctly
    mdx({
      remarkPlugins: [remarkMath],
      rehypePlugins: [rehypeKatex],
    }),
    react(),
    tailwindcss(),
  ],

  // Monorepo: tell Vite to watch changes in sibling packages so HMR
  // picks up edits to @macrokroma/shared and sim packages instantly.
  server: {
    fs: {
      allow: ["../.."],
    },
    port: 5173,
  },

  // Ensure consistent deduplication of React and Three.js across packages.
  resolve: {
    dedupe: ["react", "react-dom", "three", "@react-three/fiber"],
  },

  build: {
    outDir: "dist",
    sourcemap: true,
  },
});