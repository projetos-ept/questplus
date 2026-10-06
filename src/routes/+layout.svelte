<script lang="ts">
	let { children } = $props();
</script>

{@render children()}

<style>
	:global(:root) {
		--fundo: #f6f7f9;
		--superficie: #ffffff;
		--texto: #1b1f24;
		--suave: #5b6570;
		--borda: #d5dae0;
		--destaque: #1f5fbf;
		--sobre-destaque: #ffffff;
		--erro: #b3261e;
		--ok: #1b7a3d;
		color-scheme: light;
	}
	/* claro é o padrão, mesmo que o sistema use tema escuro; o escuro só vale por escolha no botão */
	:global(:root[data-tema='escuro']) {
		--fundo: #14171a;
		--superficie: #1d2126;
		--texto: #e8eaed;
		--suave: #9aa3ad;
		--borda: #3a4048;
		--destaque: #5b9bf0;
		--sobre-destaque: #101214;
		--erro: #f2877f;
		--ok: #6fd391;
		color-scheme: dark;
	}

	:global(body) {
		margin: 0;
		font-family: system-ui, sans-serif;
		background: var(--fundo);
		color: var(--texto);
		line-height: 1.5;
	}
	:global(main) {
		max-width: 28rem;
		margin: 0 auto;
		padding: 2rem 1rem;
	}
	:global(a) {
		color: var(--destaque);
	}
	:global(label) {
		display: block;
		margin-top: 1rem;
		font-weight: 600;
	}
	:global(input:not([type='checkbox']):not([type='radio']):not([type='file'])),
	:global(textarea),
	:global(select) {
		display: block;
		box-sizing: border-box;
		width: 100%;
		margin-top: 0.25rem;
		padding: 0.6rem;
		font: inherit;
		color: var(--texto);
		background: var(--superficie);
		border: 1px solid var(--borda);
		border-radius: 0.4rem;
	}
	:global(textarea) {
		min-height: 6rem;
		resize: vertical;
	}
	:global(button) {
		margin-top: 1.25rem;
		padding: 0.65rem 1.1rem;
		font: inherit;
		font-weight: 600;
		color: var(--sobre-destaque);
		background: var(--destaque);
		border: 0;
		border-radius: 0.4rem;
		cursor: pointer;
	}
	:global(button.sec) {
		color: var(--texto);
		background: transparent;
		border: 1px solid var(--borda);
	}
	:global(button:disabled) {
		opacity: 0.6;
		cursor: wait;
	}
	:global(:focus-visible) {
		outline: 2px solid var(--destaque);
		outline-offset: 2px;
	}
	:global(.erro) {
		color: var(--erro);
		font-weight: 600;
	}
	:global(.suave) {
		color: var(--suave);
	}
	:global(.cartao) {
		padding: 1rem;
		background: var(--superficie);
		border: 1px solid var(--borda);
		border-radius: 0.6rem;
	}
	:global(table) {
		width: 100%;
		border-collapse: collapse;
		background: var(--superficie);
	}
	:global(th),
	:global(td) {
		padding: 0.5rem 0.6rem;
		text-align: left;
		vertical-align: top;
		border-bottom: 1px solid var(--borda);
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
