<script lang="ts">
	import './impressao.css';
	import Lightbox from '#lib/components/Lightbox.svelte';
	let { children } = $props();
</script>

{@render children()}
<Lightbox />

<style>
	/* Tema: Neumorphism, layout em cartões, azul oceano, modo claro. Só cores destes tokens. */
	:global(:root) {
		--fonte-mono: Consolas, 'Courier New', monospace;
		--escala-xs: 0.72rem;
		--escala-sm: 0.82rem;
		--escala-base: 0.92rem;
		--escala-h4: 1rem;
		--escala-h3: 1.2rem;
		--escala-h2: 1.65rem;
		--escala-h1: 1.9rem;
		--entrelinha: 1.6;
		--peso-corpo: 400;
		--peso-acao: 600;
		--foco-espessura: 2px;
		--borda-cor: var(--borda);
		--cor-ornamento: var(--primaria);
		--largura-leitura: 66ch;
		--espaco: 18px;
		--altura-controle: 40px;
		--fonte: 'Century Gothic', 'Avenir Next', 'Segoe UI', sans-serif;
		--fundo: #f4f6f3;
		--superficie: #ffffff;
		--texto: #202d26;
		--texto-secundario: #3e4c43;
		--primaria: #2463eb;
		--sobre-primaria: #ffffff;
		--secundaria: #43568b;
		--sobre-secundaria: #ffffff;
		--destaque: #a14318;
		--sobre-destaque: #ffffff;
		--sucesso: #26724e;
		--sobre-sucesso: #ffffff;
		--alerta: #956215;
		--sobre-alerta: #ffffff;
		--erro: #b33645;
		--sobre-erro: #ffffff;
		--borda: #848d87;
		--raio: 20px;
		--raio-pequeno: 6px;
		--sombra: 7px 7px 18px color-mix(in srgb, var(--texto) 12%, transparent), -7px -7px 18px var(--superficie);
		--sombra-hover: 0 8px 24px color-mix(in srgb, var(--texto) 12%, transparent);
		--borda-espessura: 1px;
		--borda-estilo: solid;
		--blur: 0px;
		--opacidade-superficie: 100%;
		--peso-titulo: 650;
		--tracking: -0.035em;
		--transicao: 180ms;
		--easing: cubic-bezier(0.2, 0.7, 0.2, 1);
		--deslocamento-hover: -2px;
		--gradiente: linear-gradient(120deg, var(--superficie), var(--fundo));
		--textura: none;
		--transformacao-titulo: none;
		--proporcao-card: 1;
		--sombra-interna: inset 2px 2px 6px color-mix(in srgb, var(--texto) 8%, transparent);
		--color-scheme: light;
		color-scheme: light;
	}

	:global(body) {
		margin: 0;
		font: var(--peso-corpo) var(--escala-base) / var(--entrelinha) var(--fonte);
		background: var(--fundo);
		color: var(--texto);
	}
	:global(h1), :global(h2), :global(h3), :global(h4) {
		font-weight: var(--peso-titulo);
		letter-spacing: var(--tracking);
		text-transform: var(--transformacao-titulo);
		line-height: 1.25;
	}
	:global(h1) { font-size: var(--escala-h1); }
	:global(h2) { font-size: var(--escala-h2); }
	:global(h3) { font-size: var(--escala-h3); }
	:global(h4) { font-size: var(--escala-h4); }
	:global(code), :global(kbd), :global(pre) { font-family: var(--fonte-mono); }
	:global(hr) { border: 0; border-top: var(--borda-espessura) var(--borda-estilo) var(--borda-cor); }
	:global(main) {
		max-width: 28rem;
		margin: 0 auto;
		padding: 2rem 1rem;
	}
	:global(a) {
		color: var(--primaria);
		transition: color var(--transicao) var(--easing);
	}
	:global(a:hover) { text-decoration-thickness: 2px; }
	:global(label) {
		display: block;
		margin-top: 1rem;
		font-weight: var(--peso-acao);
	}
	:global(input:not([type='checkbox']):not([type='radio']):not([type='file'])),
	:global(textarea),
	:global(select) {
		display: block;
		box-sizing: border-box;
		width: 100%;
		min-height: var(--altura-controle);
		margin-top: 0.25rem;
		padding: 0.55rem 0.75rem;
		font: inherit;
		color: var(--texto);
		background: var(--superficie);
		border: var(--borda-espessura) var(--borda-estilo) var(--borda-cor);
		border-radius: calc(var(--raio) / 2);
		/* campo "afundado" na superfície */
		box-shadow: var(--sombra-interna);
		transition: border-color var(--transicao) var(--easing), box-shadow var(--transicao) var(--easing);
	}
	:global(input:not([type='checkbox']):not([type='radio']):not([type='file']):hover),
	:global(textarea:hover),
	:global(select:hover) { border-color: var(--primaria); }
	:global(input[aria-invalid='true']), :global(textarea[aria-invalid='true']), :global(select[aria-invalid='true']) { border-color: var(--erro); }
	:global(input[type='checkbox']), :global(input[type='radio']) { accent-color: var(--primaria); }
	:global(textarea) {
		min-height: 6rem;
		resize: vertical;
	}
	:global(button) {
		margin-top: 1.25rem;
		min-height: var(--altura-controle);
		padding: 0.55rem 1.15rem;
		font: inherit;
		font-weight: var(--peso-acao);
		color: var(--sobre-primaria);
		background: var(--primaria);
		border: var(--borda-espessura) var(--borda-estilo) var(--primaria);
		border-radius: calc(var(--raio) / 2);
		box-shadow: 3px 3px 8px color-mix(in srgb, var(--texto) 18%, transparent), -3px -3px 8px var(--superficie);
		cursor: pointer;
		transition: transform var(--transicao) var(--easing), box-shadow var(--transicao) var(--easing), background var(--transicao) var(--easing);
	}
	:global(button:hover:not(:disabled)) {
		transform: translateY(var(--deslocamento-hover));
		box-shadow: var(--sombra-hover);
	}
	:global(button:active:not(:disabled)) {
		transform: translateY(1px);
		box-shadow: var(--sombra-interna);
	}
	:global(button.sec) {
		color: var(--primaria);
		background: var(--superficie);
		border: var(--borda-espessura) var(--borda-estilo) var(--primaria);
	}
	:global(button.sec:hover:not(:disabled)) { border-width: 1px; box-shadow: var(--sombra-hover), inset 0 0 0 1px var(--primaria); }
	:global(button:disabled), :global([aria-disabled='true']) {
		opacity: 0.55;
		cursor: not-allowed;
	}
	:global(:focus-visible) {
		outline: var(--foco-espessura) solid var(--primaria);
		outline-offset: 3px;
	}
	:global(.erro) {
		color: var(--erro);
		font-weight: var(--peso-acao);
	}
	:global(.suave) {
		color: var(--texto-secundario);
	}
	:global(.cartao) {
		padding: var(--espaco);
		background: var(--superficie);
		border: var(--borda-espessura) var(--borda-estilo) var(--borda-cor);
		border-radius: var(--raio);
		box-shadow: var(--sombra);
	}
	:global(table) {
		width: 100%;
		border-collapse: collapse;
		background: var(--superficie);
	}
	:global(th),
	:global(td) {
		padding: 0.6rem 0.75rem;
		text-align: left;
		vertical-align: top;
		border-bottom: var(--borda-espessura) var(--borda-estilo) color-mix(in srgb, var(--borda) 45%, var(--superficie));
	}
	:global(th) { font-size: var(--escala-sm); color: var(--texto-secundario); }
	@media (prefers-reduced-motion: reduce) {
		:global(*), :global(*::before), :global(*::after) {
			animation-duration: 0.01ms !important;
			transition-duration: 0.01ms !important;
			scroll-behavior: auto !important;
		}
	}
	:global(.mermaid-bloco) {
		margin: 0.75rem 0;
		padding: 0.75rem;
		overflow-x: auto;
		text-align: center;
		color: var(--texto);
		background: var(--superficie);
		border: 1px solid var(--borda);
		border-radius: 0.4rem;
	}
	:global(.mermaid-bloco svg) {
		max-width: 100%;
		height: auto;
	}
	:global(.mermaid-fonte) {
		margin: 0;
		text-align: left;
		white-space: pre-wrap;
		overflow-wrap: anywhere;
		font-size: 0.85rem;
	}
	:global(.mermaid-aviso) {
		margin: 0 0 0.5rem;
		font-size: 0.85rem;
		font-weight: 600;
		color: var(--erro);
	}
	/* componente curricular, logo abaixo do título da atividade (aluno e relatórios) */
	:global(.componente) {
		margin: -0.3rem 0 0.8rem;
		font-weight: 600;
		color: var(--texto-secundario);
	}
	:global(.suporte-img) {
		margin: 0.75rem 0;
		text-align: center;
	}
	:global(.suporte-img img) {
		cursor: zoom-in;
		display: block;
		margin: 0 auto;
		max-width: 100%;
		height: auto;
		border-radius: 0.4rem;
	}
	:global(.suporte-img figcaption) {
		margin-top: 0.35rem;
		font-size: 0.85rem;
		font-style: italic;
		color: var(--texto-secundario);
	}
	:global(.etiqueta) {
		display: inline-block;
		margin: 0 0.25rem 0.25rem 0;
		padding: 0 0.5rem;
		font-size: 0.8rem;
		border: 1px solid var(--borda);
		border-radius: 1rem;
	}
</style>
