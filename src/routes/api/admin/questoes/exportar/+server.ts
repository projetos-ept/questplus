import { montarExportacao } from '#lib/importacao';
import { suportesPorIds, todasQuestoes } from '#lib/server/questoes';
import type { RequestHandler } from './$types';

/** Exporta o banco (ou o resultado de um filtro) no formato JSON próprio, que a importação lê de volta. */
export const GET: RequestHandler = async ({ url }) => {
	const p = url.searchParams;
	const ativa = p.get('ativa');
	const questoes = await todasQuestoes({
		tipo: p.get('tipo') || undefined,
		etiqueta: p.get('etiqueta') || undefined,
		ativa: ativa === '1' ? true : ativa === '0' ? false : undefined,
		q: p.get('q') || undefined
	});
	const ids = [...new Set(questoes.flatMap((q) => (q.suporte_id === null ? [] : [q.suporte_id])))];
	const arquivo = montarExportacao(questoes as never, await suportesPorIds(ids));
	const dia = new Date().toISOString().slice(0, 10);
	return new Response(JSON.stringify(arquivo, null, 2), {
		headers: {
			'content-type': 'application/json; charset=utf-8',
			'content-disposition': `attachment; filename="questplus-questoes-${dia}.json"`,
			'cache-control': 'no-store'
		}
	});
};
