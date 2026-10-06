<script lang="ts">
	import { page } from '$app/state';
	const naoEncontrada = $derived(page.status === 404);
</script>

<svelte:head><title>{naoEncontrada ? 'Página não encontrada' : 'Algo deu errado'} · QuestPlus</title></svelte:head>

<main>
	<h1>{naoEncontrada ? 'Página não encontrada' : 'Algo deu errado'}</h1>
	<p>{page.error?.message && page.error.message !== 'Not Found' ? page.error.message : naoEncontrada ? 'O endereço não existe ou mudou.' : 'Tente de novo em instantes. Se continuar, avise o professor.'}</p>
	<p><a href="/">Voltar ao início</a></p>
</main>
