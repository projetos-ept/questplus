import { json } from '@sveltejs/kit';
import { erros, idDe } from '#lib/server/api';
import { listarTentativasDaAtividade, obterAtividade } from '#lib/server/atividades';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params }) => {
	const id = idDe(params.id);
	if (!id || !(await obterAtividade(id))) return erros(['Atividade não encontrada.'], 404);
	return json({ itens: await listarTentativasDaAtividade(id) });
};
