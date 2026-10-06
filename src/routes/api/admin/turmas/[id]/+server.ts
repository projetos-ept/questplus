import { json } from '@sveltejs/kit';
import { validarTurma } from '#lib/atividade';
import { corpoJson, erros, idDe } from '#lib/server/api';
import { atualizarTurma, definirTurmaAtiva, excluirTurma } from '#lib/server/atividades';
import type { RequestHandler } from './$types';

const naoEncontrada = () => erros(['Turma não encontrada.'], 404);

export const PUT: RequestHandler = async ({ params, request }) => {
	const id = idDe(params.id);
	if (!id) return naoEncontrada();
	const r = validarTurma(await corpoJson(request));
	if (!r.ok) return erros(r.erros);
	return (await atualizarTurma(id, r.valor)) ? json({ id }) : naoEncontrada();
};

/** Ativar ou inativar. */
export const PATCH: RequestHandler = async ({ params, request }) => {
	const id = idDe(params.id);
	const corpo = (await corpoJson(request)) as { ativa?: unknown } | undefined;
	if (!id) return naoEncontrada();
	if (typeof corpo?.ativa !== 'boolean') return erros(['Informe "ativa" como verdadeiro ou falso.']);
	return (await definirTurmaAtiva(id, corpo.ativa)) ? json({ id, ativa: corpo.ativa }) : naoEncontrada();
};

/**
 * Exclui só pelo caminho seguro: turma com tentativas de alunos nunca é excluída (409, use inativar); em atividades exige
 * `?desvincular=1` e não pode deixar nenhuma atividade sem turma.
 */
export const DELETE: RequestHandler = async ({ params, url }) => {
	const id = idDe(params.id);
	if (!id) return naoEncontrada();
	const r = await excluirTurma(id, url.searchParams.get('desvincular') === '1');
	switch (r.status) {
		case 'ok':
			return json({ id });
		case 'inexistente':
			return naoEncontrada();
		case 'com-tentativas':
			return erros([`Esta turma tem ${r.tentativas} tentativa(s) de alunos registradas; excluir apagaria esse histórico. Inative a turma: ela some da lista do aluno e o histórico fica.`], 409);
		case 'em-atividades':
			return erros([`Esta turma está em ${r.total} atividade(s): ${r.atividades.join(', ')}${r.total > r.atividades.length ? ' e outras' : ''}. Confirme a retirada da turma dessas atividades ou apenas inative a turma.`], 409);
		case 'ficaria-sem-turma':
			return erros([`A turma é a única de: ${r.atividades.join(', ')}. Retirá-la deixaria a atividade sem turma e os alunos não conseguiriam entrar. Inative a turma, ou adicione outra turma à atividade antes.`], 409);
	}
};
