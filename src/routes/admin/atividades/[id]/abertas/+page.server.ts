import { error } from '@sveltejs/kit';
import { idDe } from '#lib/server/api';
import { obterAtividade } from '#lib/server/atividades';
import { filaDaAtividade } from '#lib/server/abertas';
import { iaDisponivel, modeloUsado } from '#lib/server/ia';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params }) => {
	const id = idDe(params.id);
	const a = id ? await obterAtividade(id) : null;
	if (!a) error(404, 'Atividade não encontrada');
	return { atividade: { id: a.id, titulo: a.titulo, codigo: a.codigo }, ...(await filaDaAtividade(a.id)), ia: { disponivel: iaDisponivel(), modelo: modeloUsado() } };
};
