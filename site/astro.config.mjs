// @ts-check
import { defineConfig } from "astro/config";
import starlight from "@astrojs/starlight";
import tailwindcss from "@tailwindcss/vite";

// GitHub Pages project site → served under /AmbyKit/. Override AMBYKIT_BASE for a custom domain ('/').
const base = process.env.AMBYKIT_BASE ?? "/AmbyKit";

// https://astro.build/config
export default defineConfig({
  site: "https://ambystechcom.github.io",
  base,
  vite: { plugins: [tailwindcss()] },
  integrations: [
    starlight({
      title: "AmbyKit",
      description: "Spec-Driven Development for AI coding assistants.",
      favicon: "/favicon.svg",
      logo: {
        src: "./src/assets/ambykit_logo.png",
        alt: "AmbyKit",
        replacesTitle: true,
      },
      customCss: [
        "./src/styles/global.css",
        "./src/styles/tokens.css",
        "./src/styles/theme.css",
        "./src/styles/brand.css",
      ],
      social: [
        { icon: "github", label: "GitHub", href: "https://github.com/ambystechcom/AmbyKit" },
      ],
      sidebar: [
        { label: "Start", items: [{ autogenerate: { directory: "start" } }] },
        { label: "Workflow", items: [{ autogenerate: { directory: "workflow" } }] },
        { label: "Concepts", items: [{ autogenerate: { directory: "concepts" } }] },
        { label: "CLI", items: [{ autogenerate: { directory: "cli" } }] },
      ],
    }),
  ],
});
