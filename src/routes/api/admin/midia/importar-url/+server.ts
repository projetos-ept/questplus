import { json } from '@sveltejs/kit';
import { urlPermitida } from '#lib/imagens';
import { TAMANHO_MAX_IMAGEM, TIPO_POR_EXTENSAO, detectarImagem } from '#lib/midia';
import { corpoJson, erros } from '#lib/server/api';
import { midia, permitirUrlLocal } from '#lib/server/env';
import type { RequestHandler } from './$types';

const MAX_SALTOS = 3;
const USO_ALTERNATIVO = 'Baixe a imagem no seu computador e use "Enviar arquivo".';

/** Lê o corpo até o limite; devolve null se passar dele (para não carregar um arquivo gigante na memória). */
async function lerLimitado(r: Response, max: number): Promise<Uint8Array | null> {
	const leitor = r.body?.getReader();
	if (!leitor) {
		const tudo = new Uint8Array(await r.arrayBuffer());
		return tudo.byteLength > max ? null : tudo;
	}
	const partes: Uint8Array[] = [];
	let total = 0;
	for (;;) {
		const { done, value } = await leitor.read();
		if (done) break;
		total += value.byteLength;
		if (total > max) {
			await leitor.cancel();
			return null;
		}
		partes.push(value);
	}
	const todo = new Uint8Array(total);
	let pos = 0;
	for (const p of partes) (todo.set(p, pos), (pos += p.byteLength));
	return todo;
}

/**
 * Baixa uma imagem de um link público e guarda no R2 (o aluno nunca depende do site de origem). Se o site bloquear, o
 * link for de uma página e não da imagem, ou o arquivo passar de 2 MB, devolve o motivo e o envio por arquivo segue valendo.
 */
export const POST: RequestHandler = async ({ request }) => {
	const bucket = midia();
	if (!bucket) return erros(['Armazenamento de imagens (R2) ainda não configurado.'], 503);
	const corpo = (await corpoJson(request)) as { url?: unknown } | undefined;
	const local = permitirUrlLocal();

	let alvo = urlPermitida(typeof corpo?.url === 'string' ? corpo.url : '', local);
	if (!alvo.ok) return erros([alvo.erro]);

	let resposta: Response | undefined;
	try {
		for (let salto = 0; salto <= MAX_SALTOS; salto++) {
			resposta = await fetch(alvo.url, {
				redirect: 'manual', // cada redirecionamento é conferido de novo, para não ser levado a um endereço interno
				signal: AbortSignal.timeout(10_000),
				headers: { 'user-agent': 'QuestPlus/1.0 (+https://questplus.pages.dev; material didatico)', accept: 'image/png,image/jpeg,image/webp,image/gif,*/*;q=0.5' }
			});
			if (![301, 302, 303, 307, 308].includes(resposta.status)) break;
			const destino = resposta.headers.get('location');
			if (!destino) break;
			const proximo = urlPermitida(new URL(destino, alvo.url).toString(), local);
			if (!proximo.ok) return erros(['O link redireciona para um endereço que não pode ser acessado.']);
			alvo = proximo;
			if (salto === MAX_SALTOS) return erros([`O link tem redirecionamentos demais. ${USO_ALTERNATIVO}`]);
		}
	} catch {
		return erros([`Não consegui acessar esse link: o site não respondeu a tempo ou bloqueou o acesso automático. ${USO_ALTERNATIVO}`], 502);
	}
	if (!resposta || !resposta.ok) {
		return erros([`O site respondeu "${resposta?.status ?? 'sem resposta'}" e não entregou a imagem. ${USO_ALTERNATIVO}`], 502);
	}
	if ((resposta.headers.get('content-type') ?? '').toLowerCase().startsWith('text/html')) {
		return erros(['Esse link é de uma página, não da imagem. Abra a imagem, clique com o botão direito e copie o "endereço da imagem" (termina em .png, .jpg, .webp…).']);
	}
	if (Number(resposta.headers.get('content-length')) > TAMANHO_MAX_IMAGEM) {
		return erros([`A imagem passa de 2 MB. ${USO_ALTERNATIVO} Ela é reduzida no navegador antes do envio.`], 413);
	}
	const bytes = await lerLimitado(resposta, TAMANHO_MAX_IMAGEM);
	if (!bytes) return erros([`A imagem passa de 2 MB. ${USO_ALTERNATIVO} Ela é reduzida no navegador antes do envio.`], 413);
	const ext = detectarImagem(bytes);
	if (!ext) return erros(['O arquivo desse link não é uma imagem PNG, JPG, WEBP ou GIF (SVG não é aceito).'], 415);

	const chave = `${crypto.randomUUID()}.${ext}`;
	await bucket.put(chave, bytes, { httpMetadata: { contentType: TIPO_POR_EXTENSAO[ext] } });
	return json({ chave, url: `/midia/${chave}`, origem: alvo.url.toString().slice(0, 500) }, { status: 201 });
};
