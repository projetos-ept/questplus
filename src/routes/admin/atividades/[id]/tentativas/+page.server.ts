import { error } from '@sveltejs/kit';
import { idDe } from '#lib/server/api';
import { listarTentativasDaAtividade, obterAtividade } from '#lib/server/atividades';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params }) => {
	const id = idDe(params.id);
	const atividade = id ? await obterAtividade(id) : null;
	if (!id || !atividade) error(404, 'Atividade não encontrada');
	return { atividade, tentativas: await listarTentativasDaAtividade(id) };
};
