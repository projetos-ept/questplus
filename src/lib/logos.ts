/** Logos do cabeçalho dos relatórios e da abertura da atividade: poucos, pequenos e sempre em imagem comum (nunca SVG). */
export const LIMITE_LOGOS = 6;
export const TAMANHO_MAX_LOGO = 1024 * 1024;

/** Nome do logo: de 2 a 60 caracteres, espaços repetidos viram um só. Vazio devolve o nome padrão. */
export function validarNomeLogo(entrada: unknown, padrao: string): { ok: true; valor: string } | { ok: false; erro: string } {
	const nome = typeof entrada === 'string' ? entrada.replace(/\s+/g, ' ').trim() : '';
	if (nome === '') return { ok: true, valor: padrao.slice(0, 60) };
	if (nome.length < 2 || nome.length > 60) return { ok: false, erro: 'O nome do logo deve ter de 2 a 60 caracteres.' };
	return { ok: true, valor: nome };
}

/** Nome sugerido a partir do arquivo ("logo-escola.png" vira "logo-escola"). */
export const nomeDoArquivo = (arquivo: string) => arquivo.replace(/\.[^.]+$/, '') || 'Logo';
