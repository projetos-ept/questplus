import { filtroDeParams, paramsDeFiltro } from '#lib/filtros';
import { facetasQuestoes, filtrosDeParams, listarQuestoes } from '#lib/server/questoes';
import type { PageServerLoad } from './$types';

const POR_PAGINA = 25;

export const load: PageServerLoad = async ({ url }) => {
	const p = url.searchParams;
	const pagina = Math.max(Number(p.get('pagina')) || 1, 1);
	const filtro = filtroDeParams(p);
	const consulta = filtrosDeParams(p);
	const [lista, facetas] = await Promise.all([listarQuestoes({ ...consulta, limite: POR_PAGINA, offset: (pagina - 1) * POR_PAGINA }), facetasQuestoes(consulta)]);
	return { ...lista, pagina, facetas, filtro, consulta: paramsDeFiltro(filtro).toString() };
};
