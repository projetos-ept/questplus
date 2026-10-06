import { error } from '@sveltejs/kit';
import { idDe } from '#lib/server/api';
import { listarSuportes, obterQuestao } from '#lib/server/questoes';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params }) => {
	const id = idDe(params.id);
	const questao = id ? await obterQuestao(id) : null;
	if (!id || !questao) error(404, 'Questão não encontrada');
	return { id, questao, suportes: (await listarSuportes()).map(({ id, titulo }) => ({ id, titulo })) };
};
