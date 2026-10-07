import type { Action } from 'svelte/action';

let contador = 0;
let iniciado = false;

/**
 * Desenha, no navegador, os diagramas Mermaid de um texto de apoio já renderizado (blocos .mermaid-bloco). A biblioteca só
 * é baixada quando existe um diagrama na tela. `securityLevel: 'strict'` faz o Mermaid sanear rótulos e desligar cliques;
 * os rótulos não usam HTML (sem foreignObject), para sair bem na impressão. Se o código for inválido, o bloco mostra o
 * aviso e o próprio código, em vez de ficar em branco.
 */
export const diagramas: Action<HTMLElement, unknown> = (no) => {
	let desmontado = false;
	let pausa: ReturnType<typeof setTimeout>;

	async function processar() {
		const blocos = [...no.querySelectorAll<HTMLElement>('.mermaid-bloco:not([data-feito])')];
		if (!blocos.length || desmontado) return;
		const { default: mermaid } = await import('mermaid');
		if (!iniciado) {
			mermaid.initialize({ startOnLoad: false, securityLevel: 'strict', theme: 'default', flowchart: { htmlLabels: false }, maxTextSize: 5000, fontFamily: 'inherit' });
			iniciado = true;
		}
		for (const bloco of blocos) {
			bloco.dataset.feito = '1';
			const codigo = bloco.querySelector('pre')?.textContent ?? '';
			const id = `diagrama-${++contador}`;
			try {
				const { svg } = await mermaid.render(id, codigo);
				if (desmontado || !bloco.isConnected) return;
				bloco.innerHTML = `<div class="mermaid-svg">${svg}</div>`;
				bloco.setAttribute('role', 'img');
				bloco.setAttribute('aria-label', 'Diagrama');
			} catch {
				document.getElementById(`d${id}`)?.remove(); // o Mermaid deixa um elemento de erro solto na página
				bloco.classList.add('mermaid-erro');
				bloco.insertAdjacentHTML('afterbegin', '<p class="mermaid-aviso">Não foi possível desenhar este diagrama (código inválido). Mostrando o código:</p>');
			}
		}
	}
	const agendar = () => {
		clearTimeout(pausa);
		pausa = setTimeout(processar, 350);
	};
	agendar();
	return {
		update: agendar,
		destroy() {
			desmontado = true;
			clearTimeout(pausa);
		}
	};
};
