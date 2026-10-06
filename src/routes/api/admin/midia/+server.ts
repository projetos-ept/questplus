import { json } from '@sveltejs/kit';
import { TAMANHO_MAX_IMAGEM, TIPO_POR_EXTENSAO, detectarImagem } from '#lib/midia';
import { erros } from '#lib/server/api';
import { midia } from '#lib/server/env';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request }) => {
	const bucket = midia();
	if (!bucket) return erros(['Armazenamento de imagens (R2) ainda não configurado.'], 503);

	let arquivo: FormDataEntryValue | null;
	try {
		arquivo = (await request.formData()).get('arquivo');
	} catch {
		return erros(['Envie o arquivo em multipart/form-data, no campo "arquivo".']);
	}
	if (!(arquivo instanceof File)) return erros(['Envie o arquivo no campo "arquivo".']);
	if (arquivo.size > TAMANHO_MAX_IMAGEM) return erros(['A imagem passa de 2 MB.'], 413);

	const bytes = new Uint8Array(await arquivo.arrayBuffer());
	const ext = detectarImagem(bytes);
	if (!ext) return erros(['Formato não aceito. Use PNG, JPG, WEBP ou GIF.'], 415);

	const chave = `${crypto.randomUUID()}.${ext}`;
	await bucket.put(chave, bytes, { httpMetadata: { contentType: TIPO_POR_EXTENSAO[ext] } });
	return json({ chave, url: `/midia/${chave}` }, { status: 201 });
};
