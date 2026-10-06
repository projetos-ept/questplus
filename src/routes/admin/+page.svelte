<script lang="ts">
	let { data } = $props();
</script>

<svelte:head><title>Painel · QuestPlus</title></svelte:head>

<main>
	<h1>Painel</h1>
	<p>Logado como {data.usuario?.email}.</p>
	<form method="POST" action="/admin/sair"><button type="submit">Sair</button></form>
</main>
