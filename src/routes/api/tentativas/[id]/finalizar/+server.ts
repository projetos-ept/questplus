import { json } from '@sveltejs/kit';
import { finalizarTentativa } from '#lib/server/atividades';
import { autenticar, montarEstado } from '#lib/server/tentativa';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, params }) => {
	const auth = await autenticar(request, params.id);
	if ('resposta' in auth) return auth.resposta;
	const t = auth.t.status === 'andamento' ? (await finalizarTentativa(auth.t.id))! : auth.t;
	return json(await montarEstado(t, auth.a));
};
