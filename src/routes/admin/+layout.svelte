<script lang="ts">
	import TemaBotao from '#lib/components/TemaBotao.svelte';
	let { data, children } = $props();
</script>

{#if data.usuario}
	<header>
		<nav aria-label="Painel">
			<a href="/admin">Painel</a>
			<a href="/admin/questoes">Questões</a>
			<a href="/admin/suportes">Textos de apoio</a>
			<a href="/admin/turmas">Turmas</a>
			<a href="/admin/atividades">Atividades</a>
		</nav>
		<div class="direita">
			<TemaBotao />
			<form method="POST" action="/admin/sair"><button type="submit" class="sec">Sair</button></form>
		</div>
	</header>
	<div class="conteudo">{@render children()}</div>
{:else}
	<div class="login-tema"><TemaBotao /></div>
	{@render children()}
{/if}

<style>
	header {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem 1rem;
		align-items: center;
		justify-content: space-between;
		padding: 0.6rem 1rem;
		background: var(--superficie);
		border-bottom: 1px solid var(--borda);
	}
	nav {
		display: flex;
		flex-wrap: wrap;
		gap: 0.25rem 1.25rem;
	}
	nav a {
		font-weight: 600;
		text-decoration: none;
	}
	.direita {
		display: flex;
		gap: 0.5rem;
		align-items: center;
	}
	.direita :global(button) {
		margin: 0;
		padding: 0.35rem 0.7rem;
		font-size: 0.85rem;
	}
	.conteudo {
		max-width: 60rem;
		margin: 0 auto;
		padding: 1.5rem 1rem 3rem;
	}
	.login-tema {
		display: flex;
		justify-content: flex-end;
		padding: 0.6rem 1rem;
	}
</style>
