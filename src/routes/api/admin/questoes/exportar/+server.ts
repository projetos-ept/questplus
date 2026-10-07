import { montarExportacao } from '#lib/importacao';
import { filtrosDeParams, todasQuestoes } from '#lib/server/questoes';
import type { RequestHandler } from './$types';

/** Exporta o banco (ou o resultado de um filtro) no formato JSON próprio, que a importação lê de volta. */
export const GET: RequestHandler = async ({ url }) => {
	const questoes = await todasQuestoes(filtrosDeParams(url.searchParams));
	const arquivo = montarExportacao(questoes as never);
	const dia = new Date().toISOString().slice(0, 10);
	return new Response(JSON.stringify(arquivo, null, 2), {
		headers: {
			'content-type': 'application/json; charset=utf-8',
			'content-disposition': `attachment; filename="questplus-questoes-${dia}.json"`,
			'cache-control': 'no-store'
		}
	});
};
