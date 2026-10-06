export const TAMANHO_MAX_IMAGEM = 2 * 1024 * 1024;

export type ExtensaoImagem = 'png' | 'jpg' | 'webp' | 'gif';

export const TIPO_POR_EXTENSAO: Record<ExtensaoImagem, string> = {
	png: 'image/png',
	jpg: 'image/jpeg',
	webp: 'image/webp',
	gif: 'image/gif'
};

/** Identifica a imagem pelos primeiros bytes, sem confiar no tipo informado pelo navegador. SVG fica de fora de propósito. */
export function detectarImagem(b: Uint8Array): ExtensaoImagem | null {
	const ascii = (i: number, n: number) => String.fromCharCode(...b.slice(i, i + n));
	if (b.length >= 8 && b[0] === 0x89 && ascii(1, 3) === 'PNG') return 'png';
	if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'jpg';
	if (b.length >= 6 && ascii(0, 4) === 'GIF8') return 'gif';
	if (b.length >= 12 && ascii(0, 4) === 'RIFF' && ascii(8, 4) === 'WEBP') return 'webp';
	return null;
}
