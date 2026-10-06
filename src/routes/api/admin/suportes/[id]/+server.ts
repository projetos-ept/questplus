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

/** Sem `?desvincular=1`, recusa se houver questões usando o texto de apoio. */
export const DELETE: RequestHandler = async ({ params, url }) => {
	const id = idDe(params.id);
	if (!id) return naoEncontrado();
	const r = await excluirSuporte(id, url.searchParams.get('desvincular') === '1');
	if (r === 'inexistente') return naoEncontrado();
	if (r === 'ok') return json({ id });
	return json(
		{ erros: [`Há ${r.emUso} questão(ões) usando este texto de apoio. Confirme para excluir e desvincular, ou mantenha o texto.`], emUso: r.emUso },
		{ status: 409 }
	);
};
