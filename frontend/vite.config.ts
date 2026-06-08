import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const DEV_PORT = Number(process.env.ATHQL_DEV_PORT ?? 5173);
const CUSTOM_HOST = process.env.ATHQL_DEV_HOST?.trim() || undefined;
const HAS_CUSTOM_DEV =
  Boolean(CUSTOM_HOST) || Boolean(process.env.ATHQL_DEV_ORIGINS?.trim());

function devOrigins(): string[] {
  const defaults = [`http://localhost:${DEV_PORT}`, `http://127.0.0.1:${DEV_PORT}`];
  const extra: string[] = [];
  if (CUSTOM_HOST) {
    extra.push(`http://${CUSTOM_HOST}:${DEV_PORT}`);
  }
  const origins = process.env.ATHQL_DEV_ORIGINS?.trim();
  if (origins) {
    extra.push(...origins.split(",").map((part) => part.trim()).filter(Boolean));
  }
  return [...new Set([...defaults, ...extra])];
}

function allowedHosts(origins: string[]): string[] {
  const hosts = new Set(["localhost", "127.0.0.1"]);
  for (const origin of origins) {
    try {
      hosts.add(new URL(origin).hostname);
    } catch {
      /* ignore malformed origin */
    }
  }
  if (CUSTOM_HOST) {
    hosts.add(CUSTOM_HOST);
  }
  return [...hosts];
}

const origins = devOrigins();
const primaryCustomHost =
  CUSTOM_HOST ??
  (() => {
    for (const origin of origins) {
      if (origin.includes("localhost") || origin.includes("127.0.0.1")) continue;
      try {
        return new URL(origin).hostname;
      } catch {
        continue;
      }
    }
    return undefined;
  })();

export default defineConfig({
  plugins: [react()],
  server: {
    port: DEV_PORT,
    strictPort: true,
    // Custom /etc/hosts domains resolve to 127.0.0.1 — listen on IPv4, not localhost-only.
    host: HAS_CUSTOM_DEV ? true : undefined,
    allowedHosts: allowedHosts(origins),
    ...(primaryCustomHost
      ? {
          origin: `http://${primaryCustomHost}:${DEV_PORT}`,
          hmr: {
            host: primaryCustomHost,
            port: DEV_PORT,
          },
        }
      : {}),
    proxy: {
      "/api": {
        target: process.env.ATHQL_BACKEND_URL ?? "http://127.0.0.1:8000",
        changeOrigin: true,
      },
    },
  },
});
