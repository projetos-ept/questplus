import { json } from '@sveltejs/kit';
import { estadoAtividade, validarAtividade } from '#lib/atividade';
import { corpoJson, erros, idDe } from '#lib/server/api';
import { atualizarAtividade, conferirVinculos, detalhesAtividade, obterAtividade } from '#lib/server/atividades';
import type { RequestHandler } from './$types';

const naoEncontrada = () => erros(['Atividade não encontrada.'], 404);

export const GET: RequestHandler = async ({ params }) => {
	const id = idDe(params.id);
	const a = id && (await obterAtividade(id));
	if (!id || !a) return naoEncontrada();
	return json({ ...a, estado: estadoAtividade(a), ...(await detalhesAtividade(id)) });
};

export const PUT: RequestHandler = async ({ params, request }) => {
	const id = idDe(params.id);
	if (!id) return naoEncontrada();
	const r = validarAtividade(await corpoJson(request));
	if (!r.ok) return erros(r.erros);
	const problemas = await conferirVinculos(r.valor, id);
	if (problemas.length) return erros(problemas);
	const res = await atualizarAtividade(id, r.valor);
	if (res === 'inexistente') return naoEncontrada();
	return res === 'ok' ? json({ id }) : erros([res.erro], 409);
};
