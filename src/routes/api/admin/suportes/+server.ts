import { json } from '@sveltejs/kit';
import { validarSuporte } from '#lib/questao';
import { corpoJson, erros } from '#lib/server/api';
import { criarSuporte, listarSuportes } from '#lib/server/questoes';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async () => json({ itens: await listarSuportes() });

export const POST: RequestHandler = async ({ request }) => {
	const r = validarSuporte(await corpoJson(request));
	if (!r.ok) return erros(r.erros);
	return json({ id: await criarSuporte(r.valor) }, { status: 201 });
};
