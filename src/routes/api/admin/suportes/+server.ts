import { json } from '@sveltejs/kit';
import { validarSuporte } from '#lib/questao';
import { corpoJson, erros } from '#lib/server/api';
import { criarSuporte, filtrosSuportesDeParams, listarSuportes } from '#lib/server/suportes';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url }) => json(await listarSuportes({ ...filtrosSuportesDeParams(url.searchParams), limite: Number(url.searchParams.get('limite')) || undefined, offset: Number(url.searchParams.get('offset')) || undefined }));

export const POST: RequestHandler = async ({ request }) => {
	const r = validarSuporte(await corpoJson(request));
	if (!r.ok) return erros(r.erros);
	return json({ id: await criarSuporte(r.valor) }, { status: 201 });
};
