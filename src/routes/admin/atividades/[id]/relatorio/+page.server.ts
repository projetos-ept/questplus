import { error } from '@sveltejs/kit';
import { idDe } from '#lib/server/api';
import { relatorioDaAtividade } from '#lib/server/relatorio';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, url }) => {
	const id = idDe(params.id);
	const r = id ? await relatorioDaAtividade(id, idDe(url.searchParams.get('turma') ?? '') ?? undefined) : null;
	if (!r) error(404, 'Atividade não encontrada');
	return r;
};
