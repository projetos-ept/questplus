export type Tamanho = 'pequena' | 'media' | 'grande' | 'personalizada';

export type ImagemSuporte = {
	/** Número fixo da imagem (1 a 10): é o que vale em [img3]; não muda quando outra é removida. */
	n: number;
	/** Chave do arquivo no R2. */
	chave: string;
	legenda: string;
	tamanho: Tamanho;
	/** Largura em px, só quando `tamanho` é "personalizada". */
	largura: number | null;
	/** Endereço de onde a imagem foi baixada, quando veio de um link. */
	origem: string | null;
};

export const MAX_IMAGENS = 10;
export const LARGURA_POR_TAMANHO = { pequena: 240, media: 420, grande: 640 } as const;
export const ROTULO_TAMANHO: Record<Tamanho, string> = { pequena: 'Pequena', media: 'Média', grande: 'Grande', personalizada: 'Personalizada (px)' };

export const CHAVE_IMAGEM = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(png|jpg|webp|gif)$/;
export const slugDe = (n: number) => `[img${n}]`;

/** Largura em px que a imagem deve ter na tela. */
export function larguraDe(i: Pick<ImagemSuporte, 'tamanho' | 'largura'>): number {
	return i.tamanho === 'personalizada' ? (i.largura ?? LARGURA_POR_TAMANHO.media) : LARGURA_POR_TAMANHO[i.tamanho];
}

/** Menor número livre de 1 a 10, ou null se já houver 10. */
export function proximoNumero(imagens: Pick<ImagemSuporte, 'n'>[]): number | null {
	const usados = new Set(imagens.map((i) => i.n));
	for (let n = 1; n <= MAX_IMAGENS; n++) if (!usados.has(n)) return n;
	return null;
}

export function validarImagens(entrada: unknown): { ok: true; valor: ImagemSuporte[] } | { ok: false; erros: string[] } {
	if (entrada === undefined || entrada === null) return { ok: true, valor: [] };
	if (!Array.isArray(entrada)) return { ok: false, erros: ['A lista de imagens é inválida.'] };
	if (entrada.length > MAX_IMAGENS) return { ok: false, erros: [`Cada texto de apoio aceita até ${MAX_IMAGENS} imagens.`] };
	const erros: string[] = [];
	const vistos = new Set<number>();
	const chaves = new Set<string>();
	const valor: ImagemSuporte[] = [];
	for (const [i, bruto] of entrada.entries()) {
		const o = (bruto && typeof bruto === 'object' ? bruto : {}) as Record<string, unknown>;
		const rotulo = `Imagem ${i + 1}`;
		const n = Number(o.n);
		const chave = typeof o.chave === 'string' ? o.chave : '';
		const legenda = typeof o.legenda === 'string' ? o.legenda.trim() : '';
		const tamanho = (o.tamanho ?? 'media') as Tamanho;
		if (!Number.isInteger(n) || n < 1 || n > MAX_IMAGENS) erros.push(`${rotulo}: número inválido (use de 1 a ${MAX_IMAGENS}).`);
		else if (vistos.has(n)) erros.push(`${rotulo}: o número ${n} está repetido.`);
		vistos.add(n);
		if (!CHAVE_IMAGEM.test(chave)) erros.push(`${rotulo}: arquivo inválido.`);
		else if (chaves.has(chave)) erros.push(`${rotulo}: o mesmo arquivo foi usado duas vezes.`);
		chaves.add(chave);
		if (legenda.length > 300) erros.push(`${rotulo}: a legenda passa de 300 caracteres.`);
		if (!['pequena', 'media', 'grande', 'personalizada'].includes(tamanho)) erros.push(`${rotulo}: tamanho inválido.`);
		let largura: number | null = null;
		if (tamanho === 'personalizada') {
			largura = Number(o.largura);
			if (!Number.isInteger(largura) || largura < 50 || largura > 1600) {
				erros.push(`${rotulo}: a largura deve ser um número inteiro de 50 a 1600 px.`);
				largura = null;
			}
		}
		const origem = typeof o.origem === 'string' && o.origem.trim() ? o.origem.trim().slice(0, 500) : null;
		valor.push({ n, chave, legenda, tamanho, largura, origem });
	}
	return erros.length ? { ok: false, erros } : { ok: true, valor: valor.sort((a, b) => a.n - b.n) };
}

/**
 * Imagens de um texto de apoio, aceitando os dois formatos: o novo (`imagens`) e o antigo, de uma imagem só
 * (`imagem_chave`), que ainda existe nas cópias guardadas em tentativas feitas antes desta mudança.
 */
export function imagensDe(s: { imagens?: ImagemSuporte[] | null; imagem_chave?: string | null } | null | undefined): ImagemSuporte[] {
	if (!s) return [];
	if (Array.isArray(s.imagens) && s.imagens.length) return s.imagens;
	if (s.imagem_chave) return [{ n: 1, chave: s.imagem_chave, legenda: '', tamanho: 'media', largura: null, origem: null }];
	return [];
}

// ---------- baixar imagem de um link: o que pode ser pedido ao servidor ----------

const HOSTS_INTERNOS = /(^|\.)(localhost|local|internal|lan|home|corp|intranet)$/;

/**
 * Impede que o servidor seja usado para alcançar endereços internos (SSRF). Só http(s) em porta padrão, sem usuário e
 * senha, com nome de domínio público (nada de IP, "localhost" ou nomes internos). `permitirLocal` serve só para testes.
 */
export function urlPermitida(texto: string, permitirLocal = false): { ok: true; url: URL } | { ok: false; erro: string } {
	let url: URL;
	try {
		url = new URL(texto.trim());
	} catch {
		return { ok: false, erro: 'O endereço não parece um link válido (comece com https://).' };
	}
	if (url.protocol !== 'https:' && url.protocol !== 'http:') return { ok: false, erro: 'Só links http:// ou https:// são aceitos.' };
	if (permitirLocal) return { ok: true, url };
	if (url.username || url.password) return { ok: false, erro: 'Links com usuário e senha não são aceitos.' };
	if (url.port) return { ok: false, erro: 'Links com porta personalizada não são aceitos.' };
	const h = url.hostname.toLowerCase();
	if (h.startsWith('[') || /^\d+(\.\d+){0,3}$/.test(h)) return { ok: false, erro: 'Use um link com nome de site, não um endereço IP.' };
	if (!h.includes('.') || HOSTS_INTERNOS.test(h)) return { ok: false, erro: 'Esse endereço é interno e não pode ser acessado.' };
	return { ok: true, url };
}
