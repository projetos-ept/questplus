import { error } from '@sveltejs/kit';
import { idDe } from '#lib/server/api';
import { obterSuporte } from '#lib/server/suportes';
import { detalhesAtividade, listarTurmas, obterAtividade } from '#lib/server/atividades';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, url }) => {
	const id = idDe(params.id);
	const atividade = id ? await obterAtividade(id) : null;
	if (!id || !atividade) error(404, 'Atividade não encontrada');
	const [det, turmas, sup] = await Promise.all([detalhesAtividade(id), listarTurmas(), atividade.suporte_id ? obterSuporte(atividade.suporte_id) : null]);
	return {
		id,
		atividade,
		questoes: det.questoes.map((q) => ({ questao_id: q.questao_id, enunciado: q.enunciado, tipo: q.tipo, pontos: q.pontos, pontos_padrao: q.pontos_padrao })),
		turmasSel: det.turmas,
		suporteTitulo: sup?.titulo ?? '',
		turmas,
		criada: url.searchParams.get('criada') === '1',
		clonada: url.searchParams.get('clonada') === '1'
	};
};
