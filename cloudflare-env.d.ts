/* eslint-disable @typescript-eslint/no-explicit-any -- minimal external runtime shims supplied by Cloudflare in production. */
declare module "cloudflare:workers" {
  export const env: Record<string, any>;
}

interface Fetcher {
  fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response>;
}

type D1Database = any;
