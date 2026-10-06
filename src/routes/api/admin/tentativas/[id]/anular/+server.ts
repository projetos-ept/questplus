import { json } from '@sveltejs/kit';
import { erros, idDe } from '#lib/server/api';
import { anularTentativa } from '#lib/server/atividades';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ params }) => {
	const id = idDe(params.id);
	return id && (await anularTentativa(id)) ? json({ id }) : erros(['Tentativa não encontrada.'], 404);
};
