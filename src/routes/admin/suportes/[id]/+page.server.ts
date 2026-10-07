import { error } from '@sveltejs/kit';
import { idDe } from '#lib/server/api';
import { db } from '#lib/server/env';
import { obterSuporte } from '#lib/server/suportes';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params }) => {
	const id = idDe(params.id);
	const suporte = id ? await obterSuporte(id) : null;
	if (!id || !suporte) error(404, 'Texto de apoio não encontrado');
	const uso = await db().prepare('SELECT COUNT(*) AS n FROM atividades WHERE suporte_id = ?').bind(id).first<{ n: number }>();
	return { id, suporte: { ...suporte, atividades: uso?.n ?? 0 } };
};
