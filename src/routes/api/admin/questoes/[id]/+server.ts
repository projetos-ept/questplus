import { json } from '@sveltejs/kit';
import { validarQuestao } from '#lib/questao';
import { corpoJson, erros, idDe } from '#lib/server/api';
import { atualizarQuestao, definirAtiva, excluirQuestao, obterQuestao, suporteExiste } from '#lib/server/questoes';
import type { RequestHandler } from './$types';

const naoEncontrada = () => erros(['Questão não encontrada.'], 404);

export const GET: RequestHandler = async ({ params }) => {
	const id = idDe(params.id);
	const q = id && (await obterQuestao(id));
	return q ? json(q) : naoEncontrada();
};

export const PUT: RequestHandler = async ({ params, request }) => {
	const id = idDe(params.id);
	if (!id) return naoEncontrada();
	const r = validarQuestao(await corpoJson(request));
	if (!r.ok) return erros(r.erros);
	if (r.valor.suporte_id && !(await suporteExiste(r.valor.suporte_id))) return erros(['Texto de apoio não encontrado.']);
	return (await atualizarQuestao(id, r.valor)) ? json({ id }) : naoEncontrada();
};

/** Ativa ou inativa. Questões não são apagadas, para preservar o histórico. */
export const PATCH: RequestHandler = async ({ params, request }) => {
	const id = idDe(params.id);
	const corpo = (await corpoJson(request)) as { ativa?: unknown } | undefined;
	if (!id) return naoEncontrada();
	if (typeof corpo?.ativa !== 'boolean') return erros(['Informe "ativa" como verdadeiro ou falso.']);
	return (await definirAtiva(id, corpo.ativa)) ? json({ id, ativa: corpo.ativa }) : naoEncontrada();
};

export const DELETE: RequestHandler = async ({ params }) => {
	const id = idDe(params.id);
	if (!id) return naoEncontrada();
	const r = await excluirQuestao(id);
	if (r.status === 'inexistente') return naoEncontrada();
	if (r.status === 'em-uso') {
		const lista = r.atividades.join(', ') + (r.total > r.atividades.length ? ` e mais ${r.total - r.atividades.length}` : '');
		return erros([`Esta questão está em ${r.total} atividade(s): ${lista}. Remova-a de lá, ou apenas inative a questão.`], 409);
	}
	return json({ id });
};
