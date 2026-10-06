/// <reference types="@cloudflare/workers-types" />

declare global {
	// bindings do wrangler.jsonc e segredos (.dev.vars / dashboard), lidos via `cloudflare:workers`
	namespace Cloudflare {
		interface Env {
			DB: D1Database;
			JWT_SECRET: string;
			/** Bucket R2 das imagens; ausente até o binding ser configurado. */
			MEDIA?: R2Bucket;
			/** Só para testes locais: libera o download de imagens de endereços locais. Nunca definir em produção. */
			MIDIA_URL_LOCAL?: string;
		}
	}
	namespace App {
		interface Locals {
			usuario: { id: number; email: string; papel: string } | null;
		}
	}
}

export {};
