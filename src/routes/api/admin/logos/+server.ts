import { json } from '@sveltejs/kit';
import { LIMITE_LOGOS, nomeDoArquivo, validarNomeLogo } from '#lib/logos';
import { erros } from '#lib/server/api';
import { criarLogo, guardarImagemDoLogo, listarLogos } from '#lib/server/logos';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async () => json({ itens: await listarLogos(), limite: LIMITE_LOGOS });

/** Cria um logo: multipart com `arquivo` (PNG, JPG ou WEBP, até 1 MB) e `nome` (opcional). */
export const POST: RequestHandler = async ({ request }) => {
	let f: FormData;
	try {
		f = await request.formData();
	} catch {
		return erros(['Envie em multipart/form-data, com o campo "arquivo".']);
	}
	const arquivo = f.get('arquivo');
	if (!(arquivo instanceof File)) return erros(['Envie a imagem no campo "arquivo".']);
	const nome = validarNomeLogo(f.get('nome'), nomeDoArquivo(arquivo.name));
	if (!nome.ok) return erros([nome.erro]);
	const img = await guardarImagemDoLogo(arquivo);
	if ('erro' in img) return erros([img.erro], img.status);
	const r = await criarLogo(nome.valor, img.chave);
	return 'erro' in r ? erros([r.erro], r.status) : json({ id: r.id, nome: nome.valor, chave: img.chave }, { status: 201 });
};
