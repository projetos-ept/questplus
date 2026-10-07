import { filtroDeParams, paramsDeFiltro } from '#lib/filtros';
import { facetasSuportes, filtrosSuportesDeParams, listarSuportes } from '#lib/server/suportes';
import type { PageServerLoad } from './$types';

const POR_PAGINA = 25;

export const load: PageServerLoad = async ({ url }) => {
	const p = url.searchParams;
	const pagina = Math.max(Number(p.get('pagina')) || 1, 1);
	const filtro = filtroDeParams(p);
	const consulta = filtrosSuportesDeParams(p);
	const [lista, facetas] = await Promise.all([listarSuportes({ ...consulta, limite: POR_PAGINA, offset: (pagina - 1) * POR_PAGINA }), facetasSuportes(consulta)]);
	return { itens: lista.itens, total: lista.total, limite: POR_PAGINA, pagina, facetas, filtro, consulta: paramsDeFiltro(filtro).toString() };
};
