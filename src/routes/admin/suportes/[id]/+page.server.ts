import { error } from '@sveltejs/kit';
import { idDe } from '#lib/server/api';
import { listarSuportes } from '#lib/server/questoes';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params }) => {
	const id = idDe(params.id);
	const suporte = id ? (await listarSuportes()).find((s) => s.id === id) : undefined;
	if (!id || !suporte) error(404, 'Texto de apoio não encontrado');
	return { id, suporte };
};
