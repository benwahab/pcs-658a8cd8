import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

// Configuration de test séparée : n'affecte ni l'aperçu ni la build.
export default defineConfig({
  resolve: {
    alias: [
      { find: "jsr:@supabase/supabase-js@2", replacement: fileURLToPath(new URL("./tests/edge-functions/fake-supabase.ts", import.meta.url)) },
      { find: "jsr:@supabase/functions-js/edge-runtime.d.ts", replacement: fileURLToPath(new URL("./tests/edge-functions/empty.ts", import.meta.url)) },
    ],
  },
  test: { include: ["tests/**/*.test.ts"], environment: "node" },
});
