import { etiquetasExistentes, listarQuestoes } from '#lib/server/questoes';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ url }) => {
	const p = url.searchParams;
	const pagina = Math.max(Number(p.get('pagina')) || 1, 1);
	const ativa = p.get('ativa');
	const filtros = {
		tipo: p.get('tipo') || undefined,
		etiqueta: p.get('etiqueta') || undefined,
		ativa: ativa === '1' ? true : ativa === '0' ? false : undefined,
		q: p.get('q') || undefined,
		limite: 25,
		offset: (pagina - 1) * 25
	};
	const [lista, etiquetas] = await Promise.all([listarQuestoes(filtros), etiquetasExistentes()]);
	return { ...lista, pagina, etiquetas, filtros: { tipo: filtros.tipo ?? '', etiqueta: filtros.etiqueta ?? '', ativa: ativa ?? '', q: filtros.q ?? '' } };
};
