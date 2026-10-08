import { json } from '@sveltejs/kit';
import { erros, idDe } from '#lib/server/api';
import { excluirTentativaAnulada } from '#lib/server/atividades';
import type { RequestHandler } from './$types';

/** Exclui uma tentativa **anulada** (irreversível). Tentativa que ainda conta responde 409: primeiro anule. */
export const DELETE: RequestHandler = async ({ params }) => {
	const id = idDe(params.id);
	const r = id ? await excluirTentativaAnulada(id) : 'inexistente';
	if (r === 'ok') return json({ id });
	if (r === 'nao-anulada') return erros(['Só é possível excluir tentativas anuladas. Anule primeiro.'], 409);
	return erros(['Tentativa não encontrada.'], 404);
};
