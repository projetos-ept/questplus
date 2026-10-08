import { listarAtividades } from '#lib/server/atividades';
import { pendentesPorAtividade } from '#lib/server/abertas';
import { resumoPorAtividade } from '#lib/server/relatorio';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	const [atividades, pend, resumo] = await Promise.all([listarAtividades(), pendentesPorAtividade(), resumoPorAtividade()]);
	return {
		atividades: atividades.map((a) => ({
			id: a.id,
			titulo: a.titulo,
			componente: a.componente,
			codigo: a.codigo,
			estado: a.estado,
			peso: a.peso,
			turmas: a.turmas.map((t) => t.nome),
			n_tentativas: a.n_tentativas,
			alunos: resumo.get(a.id)?.alunos ?? 0,
			media: resumo.get(a.id)?.media ?? null,
			abertas_pendentes: pend.get(a.id) ?? 0
		}))
	};
};
