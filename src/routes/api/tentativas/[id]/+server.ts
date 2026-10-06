import { json } from '@sveltejs/kit';
import { autenticar, montarEstado } from '#lib/server/tentativa';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ request, params }) => {
	const a = await autenticar(request, params.id);
	if ('resposta' in a) return a.resposta;
	return json(await montarEstado(a.t, a.a));
};
