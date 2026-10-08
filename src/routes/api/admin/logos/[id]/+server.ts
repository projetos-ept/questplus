import { json } from '@sveltejs/kit';
import { validarNomeLogo } from '#lib/logos';
import { erros, idDe } from '#lib/server/api';
import { atualizarLogo, excluirLogo, guardarImagemDoLogo } from '#lib/server/logos';
import type { RequestHandler } from './$types';

const naoEncontrado = () => erros(['Logo não encontrado.'], 404);

/** Troca o nome e/ou a imagem: multipart com `nome` e/ou `arquivo`. */
export const PUT: RequestHandler = async ({ params, request }) => {
	const id = idDe(params.id);
	if (!id) return naoEncontrado();
	let f: FormData;
	try {
		f = await request.formData();
	} catch {
		return erros(['Envie em multipart/form-data.']);
	}
	const bruto = f.get('nome');
	let nome: string | null = null;
	if (typeof bruto === 'string' && bruto.trim() !== '') {
		const v = validarNomeLogo(bruto, '');
		if (!v.ok) return erros([v.erro]);
		nome = v.valor;
	}
	let chave: string | null = null;
	const arquivo = f.get('arquivo');
	if (arquivo instanceof File && arquivo.size > 0) {
		const img = await guardarImagemDoLogo(arquivo);
		if ('erro' in img) return erros([img.erro], img.status);
		chave = img.chave;
	}
	if (nome === null && chave === null) return erros(['Informe o novo nome ou a nova imagem.']);
	return (await atualizarLogo(id, nome, chave)) === 'ok' ? json({ id, ...(nome && { nome }), ...(chave && { chave }) }) : naoEncontrado();
};

/** Em uso por atividades exige `?desvincular=1` (elas ficam sem logo); sem isso responde 409. */
export const DELETE: RequestHandler = async ({ params, url }) => {
	const id = idDe(params.id);
	if (!id) return naoEncontrado();
	const r = await excluirLogo(id, url.searchParams.get('desvincular') === '1');
	if (r === 'inexistente') return naoEncontrado();
	if (r === 'ok') return json({ id });
	return erros([`Este logo está em ${r.em_uso} atividade(s): ${r.atividades.join(', ')}${r.em_uso > r.atividades.length ? ' e outras' : ''}. Confirme para retirá-lo delas.`], 409);
};
