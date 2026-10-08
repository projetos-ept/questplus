import { json } from '@sveltejs/kit';
import { validarNomeProfessor } from '#lib/relatorio';
import { corpoJson, erros } from '#lib/server/api';
import { definirNomeDoProfessor, nomeDoProfessor } from '#lib/server/configuracoes';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async () => json({ professor: await nomeDoProfessor() });

/** Nome do professor que sai no cabeçalho de todos os relatórios; vazio ou null apaga. */
export const PUT: RequestHandler = async ({ request }) => {
	const corpo = (await corpoJson(request)) as { professor?: unknown } | undefined;
	const v = validarNomeProfessor(corpo?.professor);
	if (!v.ok) return erros([v.erro]);
	await definirNomeDoProfessor(v.valor);
	return json({ professor: v.valor });
};
