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

/**
 * Texto de apoio em HTML seguro, com as imagens nos lugares marcados por [img1]…[img10]. As imagens que o texto não cita
 * aparecem no final, para nenhuma se perder. `avisos` lista marcadores sem imagem e imagens não citadas (para o editor).
 */
export function renderSuporte(texto: string, imagens: ImagemSuporte[]) {
	const porN = new Map(imagens.map((i) => [i.n, i]));
	const citadas = new Set<number>();
	const semImagem = new Set<string>();
	let html = '';
	for (const parte of texto.split(/(\[img\d{1,2}\])/)) {
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
	const naoCitadas = imagens.filter((i) => !citadas.has(i.n));
	for (const i of naoCitadas) html += figura(i);
	return {
		html,
		semImagem: [...semImagem],
		naoCitadas: naoCitadas.map((i) => slugDe(i.n))
	};
}
