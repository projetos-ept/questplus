import { listarAtividades, listarTurmas } from '#lib/server/atividades';
import { pendentesPorAtividade } from '#lib/server/abertas';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	const [atividades, pend, turmas] = await Promise.all([listarAtividades(), pendentesPorAtividade(), listarTurmas(true)]);
	return { atividades: atividades.map((a) => ({ ...a, abertas_pendentes: pend.get(a.id) ?? 0 })), turmas: turmas.map((t) => ({ id: t.id, nome: t.nome })) };
};
