// @ts-check
import { defineConfig } from "astro/config";
import starlight from "@astrojs/starlight";
import tailwindcss from "@tailwindcss/vite";

// GitHub Pages project site → served under /AmbyKit/. Override AMBYKIT_BASE for a custom domain ('/').
//const base = process.env.AMBYKIT_BASE ?? "/AmbyKit";
const base = "/";

// https://astro.build/config
// Canonical host — the CNAME in site/public points ambykit.ambystech.io at this project's Pages
// site. This drives canonical links, the sitemap, and the absolute og:image URL below.
const site = "https://ambykit.ambystech.io";

export default defineConfig({
  site,
  base,
  vite: { plugins: [tailwindcss()] },
  integrations: [
    starlight({
      title: "AmbyKit",
      description: "Spec-Driven Development for AI coding assistants.",
      favicon: "/favicon.svg",
      // Social preview card. Starlight emits title/description/canonical itself; these add the
      // image and card type so shared links render as more than a bare text row.
      head: [
        { tag: "meta", attrs: { property: "og:image", content: `${site}/og.png` } },
        { tag: "meta", attrs: { property: "og:image:width", content: "1200" } },
        { tag: "meta", attrs: { property: "og:image:height", content: "630" } },
        {
          tag: "meta",
          attrs: { property: "og:image:alt", content: "AmbyKit — spec your UI, not just your specs." },
        },
        { tag: "meta", attrs: { name: "twitter:card", content: "summary_large_image" } },
        { tag: "meta", attrs: { name: "twitter:image", content: `${site}/og.png` } },
      ],
      logo: {
        src: "./src/assets/ambykit_logo.png",
        alt: "AmbyKit",
        replacesTitle: true,
      },
      components: {
        Footer: "./src/components/Footer.astro",
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
