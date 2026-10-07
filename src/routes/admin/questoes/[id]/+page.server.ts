import { error } from '@sveltejs/kit';
import { idDe } from '#lib/server/api';
import { obterQuestao } from '#lib/server/questoes';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, url }) => {
	const id = idDe(params.id);
	const questao = id ? await obterQuestao(id) : null;
	if (!id || !questao) error(404, 'Questão não encontrada');
	return { id, duplicada: url.searchParams.get('duplicada') === '1', questao };
};
