import { json } from '@sveltejs/kit';
import { validarComponente } from '#lib/atividade';
import { corpoJson, erros } from '#lib/server/api';
import { criarComponente, listarComponentes } from '#lib/server/componentes';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async () => json({ itens: await listarComponentes() });

export const POST: RequestHandler = async ({ request }) => {
	const r = validarComponente(await corpoJson(request));
	if (!r.ok) return erros(r.erros);
	const c = await criarComponente(r.valor.nome);
	return 'erro' in c ? erros([c.erro], 409) : json({ id: c.id, nome: r.valor.nome }, { status: 201 });
};
