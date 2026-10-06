import { json } from '@sveltejs/kit';
import { filtrosDeParams, resumoQuestoes } from '#lib/server/questoes';
import type { RequestHandler } from './$types';

/** Tudo o que o filtro encontra (até 500), em versão enxuta: usado para sortear e para adicionar todas. */
export const GET: RequestHandler = async ({ url }) => {
	const itens = await resumoQuestoes(filtrosDeParams(url.searchParams));
	return json({ itens, limitado: itens.length >= 500 });
};
