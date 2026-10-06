import { json } from '@sveltejs/kit';
import { erros, idDe } from '#lib/server/api';
import { relatorioDaTentativa } from '#lib/server/relatorio';
import type { RequestHandler } from './$types';

/** Dados do relatório individual (com gabarito): só o professor. A tela de "todos os alunos" busca um por vez. */
export const GET: RequestHandler = async ({ params }) => {
	const id = idDe(params.id);
	const r = id ? await relatorioDaTentativa(id) : null;
	return r ? json(r) : erros(['Tentativa não encontrada.'], 404);
};
