<script lang="ts">
	let { form } = $props();
</script>

<svelte:head><title>Entrar · QuestPlus</title></svelte:head>

<main>
	<h1>Área do professor</h1>
	<form method="POST">
		<label>E-mail <input name="email" type="email" required autocomplete="username" value={form?.email ?? ''} /></label>
		<label>Senha <input name="senha" type="password" required autocomplete="current-password" /></label>
		{#if form?.erro}<p class="erro" role="alert">{form.erro}</p>{/if}
		<button type="submit">Entrar</button>
	</form>
</main>
