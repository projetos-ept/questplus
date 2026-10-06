import { json } from '@sveltejs/kit';
import { erros, idDe } from '#lib/server/api';
import { clonarAtividade } from '#lib/server/atividades';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ params }) => {
	const id = idDe(params.id);
	const r = id ? await clonarAtividade(id) : null;
	if (!r) return erros(['Atividade não encontrada.'], 404);
	return 'erro' in r ? erros([r.erro], 409) : json(r, { status: 201 });
};
