import { json } from '@sveltejs/kit';
import { validarPeso } from '#lib/relatorio';
import { corpoJson, erros, idDe } from '#lib/server/api';
import { definirPeso } from '#lib/server/atividades';
import type { RequestHandler } from './$types';

/** Peso da atividade nos relatórios: de 0 a 10 com uma casa decimal; `null` ou vazio tira o peso. */
export const PUT: RequestHandler = async ({ params, request }) => {
	const id = idDe(params.id);
	const corpo = (await corpoJson(request)) as { peso?: unknown } | undefined;
	const v = validarPeso(corpo?.peso);
	if (!v.ok) return erros([v.erro]);
	return id && (await definirPeso(id, v.valor)) ? json({ id, peso: v.valor }) : erros(['Atividade não encontrada.'], 404);
};
