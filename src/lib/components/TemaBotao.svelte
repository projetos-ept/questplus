<script lang="ts">
	import { onMount } from 'svelte';

	let escuro = $state(false);

	onMount(() => {
		escuro = document.documentElement.dataset.tema
			? document.documentElement.dataset.tema === 'escuro'
			: matchMedia('(prefers-color-scheme: dark)').matches;
	});

	function alternar() {
		escuro = !escuro;
		const tema = escuro ? 'escuro' : 'claro';
		document.documentElement.dataset.tema = tema;
		try {
			localStorage.setItem('qp_tema', tema);
		} catch {}
	}
</script>

<button type="button" class="sec tema" onclick={alternar} aria-label="Alternar tema claro e escuro">
	{escuro ? '☀ Claro' : '☾ Escuro'}
</button>

<style>
	.tema {
		margin: 0;
		padding: 0.35rem 0.7rem;
		font-size: 0.85rem;
	}
</style>
