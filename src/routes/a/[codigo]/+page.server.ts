import { estadoAtividade } from '#lib/atividade';
import { obterAtividadePorCodigo, turmasDaAtividade } from '#lib/server/atividades';
import type { PageServerLoad } from './$types';

/** O gabarito não passa por aqui: a página só recebe título, datas e a lista de turmas permitidas. */
export const load: PageServerLoad = async ({ params }) => {
	const a = await obterAtividadePorCodigo(params.codigo);
	const estado = a ? estadoAtividade(a) : 'inativa';
	if (!a || estado === 'inativa') return { encontrada: false as const };
	return {
		encontrada: true as const,
		estado,
		codigo: a.codigo,
		titulo: a.titulo,
		abre_em: a.abre_em,
		fecha_em: a.fecha_em,
		regras: { modo: a.modo, tempo_total: a.tempo_total, tentativas_max: a.tentativas_max, mostra_nota: a.mostra_nota },
		turmas: estado === 'no_prazo' ? await turmasDaAtividade(a.id) : []
	};
};
