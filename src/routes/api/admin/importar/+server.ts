import { json } from '@sveltejs/kit';
import { corpoJson, erros } from '#lib/server/api';
import { MAX_QUESTOES_POR_REQUISICAO, processarBloco } from '#lib/server/importacao';
import type { RequestHandler } from './$types';

type Corpo = { questoes?: unknown[]; inicio?: number; pularDuplicadas?: boolean };

/**
 * Importação de questões em blocos, enviados pelo navegador (um arquivo grande numa só requisição estoura o tempo de CPU
 * do plano gratuito). Com `?validar=1` não grava nada e devolve o resultado por item. Textos de apoio têm rota própria:
 * `/api/admin/suportes/importar`.
 */
export const POST: RequestHandler = async ({ request, url }) => {
	const corpo = (await corpoJson(request)) as Corpo | undefined;
	if (!corpo || typeof corpo !== 'object') return erros(['Corpo da requisição inválido.']);
	const gravar = url.searchParams.get('validar') !== '1';
	if (!Array.isArray(corpo.questoes)) return erros(['Envie "questoes". Textos de apoio são importados em Textos de apoio > Importar.']);
	if (corpo.questoes.length > MAX_QUESTOES_POR_REQUISICAO) return erros([`Envie no máximo ${MAX_QUESTOES_POR_REQUISICAO} questões por vez.`]);
	return json(await processarBloco(corpo.questoes, { inicio: Number.isInteger(corpo.inicio) ? (corpo.inicio as number) : 0, gravar, pularDuplicadas: corpo.pularDuplicadas !== false }));
};
