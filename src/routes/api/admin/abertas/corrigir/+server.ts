import { json } from '@sveltejs/kit';
import { corpoJson, erros, idDe } from '#lib/server/api';
import { corrigirAberta } from '#lib/server/abertas';
import type { RequestHandler } from './$types';

/** Corrige UMA resposta aberta (triagem + IA). O painel chama uma por vez, para respeitar o limite de CPU do plano gratuito. */
export const POST: RequestHandler = async ({ request }) => {
	const c = (await corpoJson(request)) as { tentativa_id?: unknown; questao_id?: unknown } | undefined;
	const t = idDe(String(c?.tentativa_id ?? ''));
	const q = idDe(String(c?.questao_id ?? ''));
	if (!t || !q) return erros(['Informe tentativa_id e questao_id.']);
	const r = await corrigirAberta(t, q);
	if (!r.ok && r.status) return erros([r.falha], r.status);
	return json(r);
};
