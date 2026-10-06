import { json } from '@sveltejs/kit';
import { validarTurma } from '#lib/atividade';
import { corpoJson, erros, idDe } from '#lib/server/api';
import { atualizarTurma, definirTurmaAtiva } from '#lib/server/atividades';
import type { RequestHandler } from './$types';

const naoEncontrada = () => erros(['Turma não encontrada.'], 404);

export const PUT: RequestHandler = async ({ params, request }) => {
	const id = idDe(params.id);
	if (!id) return naoEncontrada();
	const r = validarTurma(await corpoJson(request));
	if (!r.ok) return erros(r.erros);
	return (await atualizarTurma(id, r.valor)) ? json({ id }) : naoEncontrada();
};

/** Turmas não são apagadas (o histórico das tentativas aponta para elas); só ativadas ou inativadas. */
export const PATCH: RequestHandler = async ({ params, request }) => {
	const id = idDe(params.id);
	const corpo = (await corpoJson(request)) as { ativa?: unknown } | undefined;
	if (!id) return naoEncontrada();
	if (typeof corpo?.ativa !== 'boolean') return erros(['Informe "ativa" como verdadeiro ou falso.']);
	return (await definirTurmaAtiva(id, corpo.ativa)) ? json({ id, ativa: corpo.ativa }) : naoEncontrada();
};
