<script lang="ts">
	import { page } from '$app/state';
	let { form } = $props();
</script>

<svelte:head><title>Entrar · QuestPlus</title></svelte:head>

<main>
	<h1>Área do professor</h1>
	{#if page.url.searchParams.get('expirou') === '1'}<p class="suave" role="status">Sua sessão expirou. Entre de novo para continuar; o que você não salvou nesta tela foi perdido.</p>{/if}
	<form method="POST">
		<label>E-mail <input name="email" type="email" required autocomplete="username" value={form?.email ?? ''} /></label>
		<label>Senha <input name="senha" type="password" required autocomplete="current-password" /></label>
		{#if form?.erro}<p class="erro" role="alert">{form.erro}</p>{/if}
		<button type="submit">Entrar</button>
	</form>
</main>
