import { json } from '@sveltejs/kit';
import { corpoJson, erros } from '#lib/server/api';
import { MAX_SUPORTES_POR_REQUISICAO, processarBlocoSuportes } from '#lib/server/importacao';
import type { RequestHandler } from './$types';

type Corpo = { suportes?: unknown[]; inicio?: number; pularDuplicadas?: boolean };

/** Importa textos de apoio em blocos pequenos (cada imagem custa uma consulta ao R2). `?validar=1` não grava nada. */
export const POST: RequestHandler = async ({ request, url }) => {
	const corpo = (await corpoJson(request)) as Corpo | undefined;
	if (!corpo || !Array.isArray(corpo.suportes)) return erros(['Envie "suportes".']);
	if (corpo.suportes.length > MAX_SUPORTES_POR_REQUISICAO) return erros([`Envie no máximo ${MAX_SUPORTES_POR_REQUISICAO} textos de apoio por vez.`]);
	return json(
		await processarBlocoSuportes(corpo.suportes, {
			inicio: Number.isInteger(corpo.inicio) ? (corpo.inicio as number) : 0,
			gravar: url.searchParams.get('validar') !== '1',
			pularDuplicadas: corpo.pularDuplicadas !== false
		})
	);
};
