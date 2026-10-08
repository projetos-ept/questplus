import { error } from '@sveltejs/kit';
import { consolidar } from '#lib/relatorio';
import { idDe } from '#lib/server/api';
import { obterAtividade } from '#lib/server/atividades';
import { tentativasDaAtividade, turmasComTentativas } from '#lib/server/relatorio';
import type { PageServerLoad } from './$types';

/** Só a lista de tentativas (a de maior nota de cada aluno). O navegador busca o detalhe de uma em uma e monta a página. */
export const load: PageServerLoad = async ({ params, url }) => {
	const id = idDe(params.id);
	const atividade = id ? await obterAtividade(id) : null;
	if (!id || !atividade) error(404, 'Atividade não encontrada');
	const turmaId = idDe(url.searchParams.get('turma') ?? '') ?? undefined;
	const alunos = consolidar(await tentativasDaAtividade(id, turmaId));
	return { atividade, turmas: await turmasComTentativas(id), turmaId: turmaId ?? null, ids: alunos.map((a) => a.melhor.id) };
};
