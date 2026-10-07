import { larguraDe, slugDe, type ImagemSuporte } from './imagens';
import { renderMarkdown } from './markdown';

const escaparHtml = (s: string) =>
	s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

function figura(i: ImagemSuporte) {
	const legenda = escaparHtml(i.legenda);
	// chave e largura vêm de formatos validados (UUID + extensão; inteiro), e a legenda é escapada
	return (
		`<figure class="suporte-img"><img src="/midia/${i.chave}" alt="${legenda || `Imagem ${i.n}`}" loading="lazy" style="width:${larguraDe(i)}px">` +
		(legenda ? `<figcaption>${legenda}</figcaption>` : '') +
		'</figure>'
	);
}

/** Diagramas Mermaid: bloco ```mermaid … ```. No máximo 3 por texto e 3000 caracteres cada. */
export const MAX_DIAGRAMAS = 3;
export const MAX_CHARS_DIAGRAMA = 3000;
const BLOCO_MERMAID = /```mermaid[ \t]*\r?\n([\s\S]*?)\r?\n?```/g;

/** O código vai escapado dentro de um <pre>: sem JavaScript (ou se o diagrama falhar) o leitor ainda vê o texto. */
function blocoDiagrama(codigo: string) {
	return `<div class="mermaid-bloco" data-mermaid><pre class="mermaid-fonte">${escaparHtml(codigo.trim())}</pre></div>`;
}

/** Quantos diagramas o texto tem e se algum passa do limite de tamanho (para a validação e para o editor). */
export function contarDiagramas(texto: string) {
	const codigos = [...texto.matchAll(BLOCO_MERMAID)].map((m) => m[1]);
	return { total: codigos.length, grandes: codigos.filter((c) => c.length > MAX_CHARS_DIAGRAMA).length };
}

/**
 * Texto de apoio em HTML seguro, com as imagens nos lugares marcados por [img1]…[img10] e os diagramas Mermaid
 * (blocos ```mermaid) prontos para o navegador desenhar. As imagens que o texto não cita aparecem no final, para nenhuma
 * se perder. `avisos` lista marcadores sem imagem e imagens não citadas (para o editor).
 */
export function renderSuporte(texto: string, imagens: ImagemSuporte[]) {
	const porN = new Map(imagens.map((i) => [i.n, i]));
	const citadas = new Set<number>();
	const semImagem = new Set<string>();
	let diagramas = 0;
	const renderTrecho = (trecho: string) => {
		let html = '';
		for (const parte of trecho.split(/(\[img\d{1,2}\])/)) {
			const m = /^\[img(\d{1,2})\]$/.exec(parte);
			const img = m ? porN.get(Number(m[1])) : undefined;
			if (img) {
				citadas.add(img.n);
				html += figura(img);
			} else {
				if (m) semImagem.add(parte);
				html += renderMarkdown(parte);
			}
		}
		return html;
	};
	let html = '';
	let fim = 0;
	for (const m of texto.matchAll(BLOCO_MERMAID)) {
		html += renderTrecho(texto.slice(fim, m.index));
		fim = (m.index ?? 0) + m[0].length;
		// passou do limite de diagramas ou de tamanho: aparece como código comum, sem desenhar
		html += diagramas < MAX_DIAGRAMAS && m[1].length <= MAX_CHARS_DIAGRAMA ? blocoDiagrama(m[1]) : `<pre class="mermaid-fonte">${escaparHtml(m[1].trim())}</pre>`;
		diagramas++;
	}
	html += renderTrecho(texto.slice(fim));
	const naoCitadas = imagens.filter((i) => !citadas.has(i.n));
	for (const i of naoCitadas) html += figura(i);
	return {
		html,
		semImagem: [...semImagem],
		naoCitadas: naoCitadas.map((i) => slugDe(i.n)),
		diagramas: Math.min(diagramas, MAX_DIAGRAMAS)
	};
}
