import { listarAtividades } from '#lib/server/atividades';
import { pendentesPorAtividade } from '#lib/server/abertas';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	const [atividades, pend] = await Promise.all([listarAtividades(), pendentesPorAtividade()]);
	return { atividades: atividades.map((a) => ({ ...a, abertas_pendentes: pend.get(a.id) ?? 0 })) };
};
