import { json } from '@sveltejs/kit';
import { validarTurma } from '#lib/atividade';
import { corpoJson, erros } from '#lib/server/api';
import { criarTurma, listarTurmas } from '#lib/server/atividades';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url }) => json({ itens: await listarTurmas(url.searchParams.get('ativas') === '1') });

export const POST: RequestHandler = async ({ request }) => {
	const r = validarTurma(await corpoJson(request));
	if (!r.ok) return erros(r.erros);
	return json({ id: await criarTurma(r.valor) }, { status: 201 });
};
