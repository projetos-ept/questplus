import { json } from '@sveltejs/kit';
import { validarSuporte } from '#lib/questao';
import { corpoJson, erros, idDe } from '#lib/server/api';
import { atualizarSuporte, excluirSuporte, obterSuporte } from '#lib/server/questoes';
import type { RequestHandler } from './$types';

const naoEncontrado = () => erros(['Texto de apoio não encontrado.'], 404);

export const GET: RequestHandler = async ({ params }) => {
	const id = idDe(params.id);
	const s = id && (await obterSuporte(id));
	return s ? json(s) : naoEncontrado();
};

export const PUT: RequestHandler = async ({ params, request }) => {
	const id = idDe(params.id);
	if (!id) return naoEncontrado();
	const r = validarSuporte(await corpoJson(request));
	if (!r.ok) return erros(r.erros);
	return (await atualizarSuporte(id, r.valor)) ? json({ id }) : naoEncontrado();
};

export const DELETE: RequestHandler = async ({ params }) => {
	const id = idDe(params.id);
	if (!id) return naoEncontrado();
	const r = await excluirSuporte(id);
	if (r === 'inexistente') return naoEncontrado();
	if (r === 'em-uso') return erros(['Há questões usando este texto de apoio. Remova o vínculo antes de excluir.'], 409);
	return json({ id });
};
