import { LIMITE_LOGOS, TAMANHO_MAX_LOGO } from '#lib/logos';
import { TIPO_POR_EXTENSAO, detectarImagem } from '#lib/midia';
import { db, midia } from './env';

export type LogoLinha = { id: number; nome: string; chave: string; n_atividades: number };

export async function listarLogos() {
	const r = await db()
		.prepare('SELECT l.id, l.nome, l.chave, (SELECT COUNT(*) FROM atividades a WHERE a.logo_id = l.id) AS n_atividades FROM logos l ORDER BY l.id')
		.all<LogoLinha>();
	return r.results;
}

/** Valida o arquivo (imagem de verdade pelos bytes, até 1 MB, nunca SVG) e grava no R2. Devolve a chave ou o motivo da recusa. */
export async function guardarImagemDoLogo(arquivo: File): Promise<{ chave: string } | { erro: string; status: number }> {
	const bucket = midia();
	if (!bucket) return { erro: 'Armazenamento de imagens (R2) ainda não configurado.', status: 503 };
	if (arquivo.size > TAMANHO_MAX_LOGO) return { erro: 'O logo passa de 1 MB.', status: 413 };
	const bytes = new Uint8Array(await arquivo.arrayBuffer());
	const ext = detectarImagem(bytes);
	if (!ext || ext === 'gif') return { erro: 'Formato não aceito. Use PNG, JPG ou WEBP.', status: 415 };
	const chave = `${crypto.randomUUID()}.${ext}`;
	await bucket.put(chave, bytes, { httpMetadata: { contentType: TIPO_POR_EXTENSAO[ext] } });
	return { chave };
}

const apagarImagem = async (chave: string) => {
	try {
		await midia()?.delete(chave);
	} catch {
		// arquivo órfão no R2 não atrapalha: o registro já saiu do banco
	}
};

export async function criarLogo(nome: string, chave: string): Promise<{ id: number } | { erro: string; status: number }> {
	const n = (await db().prepare('SELECT COUNT(*) AS n FROM logos').first<{ n: number }>())!.n;
	if (n >= LIMITE_LOGOS) {
		await apagarImagem(chave);
		return { erro: `O limite é de ${LIMITE_LOGOS} logos. Exclua um para enviar outro.`, status: 409 };
	}
	const r = await db().prepare('INSERT INTO logos (nome, chave) VALUES (?, ?) RETURNING id').bind(nome, chave).first<{ id: number }>();
	return { id: r!.id };
}

/** Troca o nome e/ou a imagem (a imagem velha sai do R2). */
export async function atualizarLogo(id: number, nome: string | null, chave: string | null): Promise<'ok' | 'inexistente'> {
	const atual = await db().prepare('SELECT chave FROM logos WHERE id = ?').bind(id).first<{ chave: string }>();
	if (!atual) {
		if (chave) await apagarImagem(chave);
		return 'inexistente';
	}
	await db().prepare('UPDATE logos SET nome = COALESCE(?, nome), chave = COALESCE(?, chave) WHERE id = ?').bind(nome, chave, id).run();
	if (chave && chave !== atual.chave) await apagarImagem(atual.chave);
	return 'ok';
}

/** Em uso por atividades só com `desvincular` (elas ficam sem logo); sem isso devolve quantas usam, para a tela pedir confirmação. */
export async function excluirLogo(id: number, desvincular: boolean): Promise<'ok' | 'inexistente' | { em_uso: number; atividades: string[] }> {
	const l = await db().prepare('SELECT chave FROM logos WHERE id = ?').bind(id).first<{ chave: string }>();
	if (!l) return 'inexistente';
	const uso = await db().prepare('SELECT titulo FROM atividades WHERE logo_id = ? ORDER BY titulo').bind(id).all<{ titulo: string }>();
	if (uso.results.length && !desvincular) return { em_uso: uso.results.length, atividades: uso.results.slice(0, 5).map((x) => x.titulo) };
	await db().batch([db().prepare('UPDATE atividades SET logo_id = NULL WHERE logo_id = ?').bind(id), db().prepare('DELETE FROM logos WHERE id = ?').bind(id)]);
	await apagarImagem(l.chave);
	return 'ok';
}
