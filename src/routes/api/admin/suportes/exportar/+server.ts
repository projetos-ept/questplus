import { montarExportacaoSuportes } from '#lib/importacao-suportes';
import { filtrosSuportesDeParams, listarSuportes } from '#lib/server/suportes';
import type { RequestHandler } from './$types';

/** Exporta os textos de apoio (ou o resultado de um filtro) no JSON próprio, que a importação lê de volta. */
export const GET: RequestHandler = async ({ url }) => {
	const { itens } = await listarSuportes({ ...filtrosSuportesDeParams(url.searchParams), limite: 500 });
	const dia = new Date().toISOString().slice(0, 10);
	return new Response(JSON.stringify(montarExportacaoSuportes(itens), null, 2), {
		headers: {
			'content-type': 'application/json; charset=utf-8',
			'content-disposition': `attachment; filename="questplus-suportes-${dia}.json"`,
			'cache-control': 'no-store'
		}
	});
};
