import { env } from 'cloudflare:workers';

export function db() {
	return env.DB;
}

export function segredoJwt() {
	if (!env.JWT_SECRET) throw new Error('JWT_SECRET não configurado');
	return env.JWT_SECRET;
}

export function midia() {
	return env.MEDIA;
}

export function permitirUrlLocal() {
	return env.MIDIA_URL_LOCAL === '1';
}

/** Limite numérico vindo das variáveis do wrangler; valor ausente ou inválido usa o padrão. */
export function limiteConfigurado(nome: 'LIMITE_PALPITES_IP_DIA' | 'LIMITE_INICIOS_IP_ATIVIDADE_DIA' | 'LIMITE_LOGIN_FALHAS_IP_HORA' | 'LIMITE_LOGIN_FALHAS_EMAIL_HORA', padrao: number) {
	const n = Number(env[nome]);
	return Number.isInteger(n) && n > 0 ? n : padrao;
}

export const MODELO_LLM_PADRAO = '@cf/meta/llama-3.3-70b-instruct-fp8-fast';
export const MODELO_EMBEDDING_PADRAO = '@cf/baai/bge-m3';

export function configIa() {
	return {
		fake: env.IA_FAKE === '1',
		ai: env.AI,
		llm: env.IA_MODELO_LLM || MODELO_LLM_PADRAO,
		embedding: env.IA_MODELO_EMBEDDING || MODELO_EMBEDDING_PADRAO
	};
}
