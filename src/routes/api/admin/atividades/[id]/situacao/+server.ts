import { json } from '@sveltejs/kit';
import { corpoJson, erros, idDe } from '#lib/server/api';
import { definirAtividadeAtiva } from '#lib/server/atividades';
import type { RequestHandler } from './$types';

/** Interruptor manual do professor. Inativar não apaga nada: tentativas e relatórios continuam disponíveis. */
export const PUT: RequestHandler = async ({ params, request }) => {
	const id = idDe(params.id);
	const corpo = (await corpoJson(request)) as { ativa?: unknown } | undefined;
	if (typeof corpo?.ativa !== 'boolean') return erros(['Informe "ativa" como verdadeiro ou falso.']);
	return id && (await definirAtividadeAtiva(id, corpo.ativa)) ? json({ id, ativa: corpo.ativa }) : erros(['Atividade não encontrada.'], 404);
};
