<script lang="ts">
	let { children } = $props();
</script>

{@render children()}

<style>
	:global(:root) {
		--fundo: #f6f7f9;
		--texto: #1b1f24;
		--suave: #5b6570;
		--borda: #d5dae0;
		--destaque: #1f5fbf;
		--erro: #b3261e;
		color-scheme: light dark;
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
	:global(label) {
		display: block;
		margin-top: 1rem;
		font-weight: 600;
	}
	:global(input) {
		display: block;
		box-sizing: border-box;
		width: 100%;
		margin-top: 0.25rem;
		padding: 0.6rem;
		font: inherit;
		border: 1px solid var(--borda);
		border-radius: 0.4rem;
	}
	:global(button) {
		margin-top: 1.25rem;
		padding: 0.65rem 1.1rem;
		font: inherit;
		font-weight: 600;
		color: #fff;
		background: var(--destaque);
		border: 0;
		border-radius: 0.4rem;
		cursor: pointer;
	}
	:global(.erro) {
		color: var(--erro);
		font-weight: 600;
	}
	@media (prefers-color-scheme: dark) {
		:global(:root) {
			--fundo: #14171a;
			--texto: #e8eaed;
			--suave: #9aa3ad;
			--borda: #3a4048;
			--destaque: #5b9bf0;
		}
		:global(input) {
			background: #1d2126;
			color: inherit;
		}
		:global(button) {
			color: #101214;
		}
	}
</style>
