import { defineCollection } from "astro:content";
import { docsLoader } from "@astrojs/starlight/loaders";
import { docsSchema } from "@astrojs/starlight/schema";
import { z } from "astro/zod";

// Phase pages (US-2) carry extra frontmatter checked against src/prompts by scripts/check-docs-sync.mjs
// (FR-014). All optional so non-phase pages validate unchanged.
export const collections = {
  docs: defineCollection({
    loader: docsLoader(),
    schema: docsSchema({
      extend: z.object({
        phase: z.string().optional(),
        order: z.number().optional(),
        command: z.string().optional(),
        reads: z.array(z.string()).optional(),
        writes: z.array(z.string()).optional(),
      }),
    }),
  }),
};
