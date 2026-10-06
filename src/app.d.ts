/// <reference types="@cloudflare/workers-types" />

declare global {
	// bindings do wrangler.jsonc e segredos (.dev.vars / dashboard), lidos via `cloudflare:workers`
	namespace Cloudflare {
		interface Env {
			DB: D1Database;
			JWT_SECRET: string;
		}
	}
	namespace App {
		interface Locals {
			usuario: { id: number; email: string; papel: string } | null;
		}
	}
}

export {};
