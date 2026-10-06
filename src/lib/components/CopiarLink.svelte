<script lang="ts">
	let { codigo }: { codigo: string } = $props();
	let copiado = $state(false);
	let campo: HTMLInputElement | undefined = $state();

	const link = $derived(typeof location === 'undefined' ? `/${codigo}` : `${location.origin}/${codigo}`);

	async function copiar() {
		try {
			await navigator.clipboard.writeText(link);
		} catch {
			campo?.select(); // sem permissão de área de transferência: deixa o link selecionado para Ctrl+C
			return;
		}
		copiado = true;
		setTimeout(() => (copiado = false), 2000);
	}
</script>

<div class="copiar">
	<input bind:this={campo} readonly value={link} aria-label="Link da atividade" onfocus={(e) => e.currentTarget.select()} />
	<button type="button" onclick={copiar}>{copiado ? 'Copiado ✔' : 'Copiar link'}</button>
</div>

<style>
	.copiar { display: flex; gap: 0.5rem; align-items: stretch; }
	.copiar input { margin: 0; flex: 1; font-family: ui-monospace, monospace; }
	.copiar button { margin: 0; white-space: nowrap; }
</style>
