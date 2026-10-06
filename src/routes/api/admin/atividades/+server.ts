import { json } from '@sveltejs/kit';
import { validarAtividade } from '#lib/atividade';
import { corpoJson, erros } from '#lib/server/api';
import { conferirVinculos, criarAtividade, listarAtividades } from '#lib/server/atividades';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async () => json({ itens: await listarAtividades() });

export const POST: RequestHandler = async ({ request }) => {
	const r = validarAtividade(await corpoJson(request));
	if (!r.ok) return erros(r.erros);
	const problemas = await conferirVinculos(r.valor, null);
	if (problemas.length) return erros(problemas);
	const criada = await criarAtividade(r.valor);
	return 'erro' in criada ? erros([criada.erro], 409) : json(criada, { status: 201 });
};
