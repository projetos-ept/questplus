/// <reference types="@cloudflare/workers-types" />

declare global {
	// bindings do wrangler.jsonc e segredos (.dev.vars / dashboard), lidos via `cloudflare:workers`
	namespace Cloudflare {
		interface Env {
			DB: D1Database;
			JWT_SECRET: string;
			/** Bucket R2 das imagens; ausente até o binding ser configurado. */
			MEDIA?: R2Bucket;
			/** Palpites errados (código ou turma) por endereço de rede em 24 h; passado o limite, o endereço fica sem iniciar tentativas até a janela acabar. */
			LIMITE_PALPITES_IP_DIA?: string;
			/** Tentativas iniciadas por endereço de rede em uma mesma atividade em 24 h. */
			LIMITE_INICIOS_IP_ATIVIDADE_DIA?: string;
			/** Senhas erradas no login do professor por endereço de rede em 1 h. */
			LIMITE_LOGIN_FALHAS_IP_HORA?: string;
			/** Senhas erradas no login do professor por e-mail em 1 h (freio geral contra tentativas distribuídas). */
			LIMITE_LOGIN_FALHAS_EMAIL_HORA?: string;
			/** Workers AI (correção de questões abertas). Ausente: a correção por IA fica indisponível e o professor corrige à mão. */
			AI?: Ai;
			/** Modelos configuráveis sem mexer no código (ids do catálogo do Workers AI). */
			IA_MODELO_LLM?: string;
			IA_MODELO_EMBEDDING?: string;
			/** Só para testes locais: troca o Workers AI por um modelo simulado e determinístico. Nunca definir em produção. */
			IA_FAKE?: string;
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
