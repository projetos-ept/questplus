import { json } from '@sveltejs/kit';
import { validarQuestao } from '#lib/questao';
import { corpoJson, erros } from '#lib/server/api';
import { criarQuestao, filtrosDeParams, listarQuestoes } from '#lib/server/questoes';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url }) => {
	const p = url.searchParams;
	return json(
		await listarQuestoes({
			...filtrosDeParams(p),
			limite: Number(p.get('limite')) || undefined,
			offset: Number(p.get('offset')) || undefined
		})
	);
};

export const POST: RequestHandler = async ({ request }) => {
	const r = validarQuestao(await corpoJson(request));
	if (!r.ok) return erros(r.erros);
	return json({ id: await criarQuestao(r.valor) }, { status: 201 });
};
