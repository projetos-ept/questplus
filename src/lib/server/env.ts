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
