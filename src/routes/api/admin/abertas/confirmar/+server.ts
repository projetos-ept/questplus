import { json } from '@sveltejs/kit';
import { corpoJson, erros, idDe } from '#lib/server/api';
import { confirmarAberta } from '#lib/server/abertas';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, locals }) => {
	const c = (await corpoJson(request)) as { tentativa_id?: unknown; questao_id?: unknown; nivel?: unknown } | undefined;
	const t = idDe(String(c?.tentativa_id ?? ''));
	const q = idDe(String(c?.questao_id ?? ''));
	if (!t || !q) return erros(['Informe tentativa_id e questao_id.']);
	const r = await confirmarAberta(t, q, c?.nivel, locals.usuario?.email ?? 'professor');
	return r.ok ? json(r) : erros([r.erro], r.status);
};
