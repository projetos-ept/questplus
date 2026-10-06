import { error } from '@sveltejs/kit';
import { CHAVE_IMAGEM } from '#lib/imagens';
import { midia } from '#lib/server/env';
import type { RequestHandler } from './$types';

// Rota aberta (o aluno precisa ver as imagens). A chave é um UUID, e só imagens passam pelo upload.
export const GET: RequestHandler = async ({ params }) => {
	const bucket = midia();
	if (!bucket || !CHAVE_IMAGEM.test(params.chave)) error(404);
	const obj = await bucket.get(params.chave);
	if (!obj) error(404);
	return new Response(obj.body, {
		headers: {
			'content-type': obj.httpMetadata?.contentType ?? 'application/octet-stream',
			'cache-control': 'public, max-age=31536000, immutable',
			'x-content-type-options': 'nosniff',
			'content-security-policy': "default-src 'none'; sandbox"
		}
	});
};
