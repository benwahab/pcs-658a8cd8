import { vi } from "vitest";

type Handler = (req: Request) => Promise<Response>;

// Charge une Edge Function en capturant le gestionnaire passé à Deno.serve.
export async function loadFunction(path: string): Promise<Handler> {
  vi.resetModules();
  let handler: Handler | undefined;
  const env: Record<string, string> = {
    SUPABASE_URL: "https://test.supabase.co",
    SUPABASE_SERVICE_ROLE_KEY: "service",
    SUPABASE_ANON_KEY: "anon",
  };
  (globalThis as any).Deno = {
    serve: (h: Handler) => {
      handler = h;
    },
    env: { get: (k: string) => env[k] },
  };
  await import(/* @vite-ignore */ path);
  if (!handler) throw new Error("Deno.serve non appelé");
  return handler;
}

export const post = (body: unknown, headers: Record<string, string> = {}) =>
  new Request("https://fn.test/", {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
