import { error } from '@sveltejs/kit';
import { idDe } from '#lib/server/api';
import { relatorioDaTentativa } from '#lib/server/relatorio';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params }) => {
	const id = idDe(params.id);
	const dados = id ? await relatorioDaTentativa(id) : null;
	if (!dados) error(404, 'Tentativa não encontrada');
	return { dados };
};
