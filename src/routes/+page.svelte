<script lang="ts">
	function entrar(e: SubmitEvent) {
		e.preventDefault();
		const codigo = new FormData(e.currentTarget as HTMLFormElement).get('codigo')?.toString().trim();
		if (codigo) location.href = `/a/${encodeURIComponent(codigo)}`;
	}
</script>

<svelte:head><title>QuestPlus</title></svelte:head>

<main>
	<h1>QuestPlus</h1>
	<p>Digite o código da atividade que o professor passou.</p>
	<form onsubmit={entrar}>
		<label>Código da atividade <input name="codigo" required autocomplete="off" /></label>
		<button type="submit">Entrar</button>
	</form>
	<p><a href="/admin">Área do professor</a></p>
</main>

