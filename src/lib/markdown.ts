// Markdown mínimo e seguro: todo o texto é escapado ANTES de qualquer marcação,
// então HTML digitado pelo professor nunca chega à tela como HTML.
const esc = (s: string) =>
	s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

function inline(bruto: string) {
	const guardados: string[] = [];
	const guardar = (html: string) => `\u0000${guardados.push(html) - 1}\u0000`;
	let s = esc(bruto.replace(/\u0000/g, ''));
	s = s.replace(/`([^`]+)`/g, (_, c) => guardar(`<code>${c}</code>`));
	s = s.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, (_, t, u) =>
		guardar(`<a href="${u}" target="_blank" rel="noopener noreferrer">${t}</a>`)
	);
	s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>').replace(/\*([^*]+)\*/g, '<em>$1</em>');
	return s.replace(/\u0000(\d+)\u0000/g, (_, i) => guardados[Number(i)]);
}

export function renderMarkdown(texto: string): string {
	return texto
		.replace(/\r\n?/g, '\n')
		.split(/\n{2,}/)
		.map((bloco) => bloco.trim())
		.filter(Boolean)
		.map((bloco) => {
			const linhas = bloco.split('\n');
			if (linhas.every((l) => /^[-*] /.test(l))) {
				return `<ul>${linhas.map((l) => `<li>${inline(l.slice(2))}</li>`).join('')}</ul>`;
			}
			if (linhas.every((l) => /^\d+\. /.test(l))) {
				return `<ol>${linhas.map((l) => `<li>${inline(l.replace(/^\d+\. /, ''))}</li>`).join('')}</ol>`;
			}
			const titulo = /^(#{1,3}) (.+)$/.exec(bloco);
			if (titulo && linhas.length === 1) return `<h${titulo[1].length + 2}>${inline(titulo[2])}</h${titulo[1].length + 2}>`;
			return `<p>${linhas.map(inline).join('<br>')}</p>`;
		})
		.join('');
}
