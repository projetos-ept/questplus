<script lang="ts">
	import { onMount } from 'svelte';
	import TemaBotao from '#lib/components/TemaBotao.svelte';
	let { data, children } = $props();

	// Sessão vencida (dura 12 h): em vez de um erro genérico no formulário, volta ao login com uma explicação.
	onMount(() => {
		const original = window.fetch;
		window.fetch = async (...args) => {
			const resposta = await original(...args);
			const url = typeof args[0] === 'string' ? args[0] : args[0] instanceof URL ? args[0].pathname : args[0].url;
			if (resposta.status === 401 && /\/api\/admin\//.test(url)) {
				(window as unknown as { __qpSaidaForcada?: boolean }).__qpSaidaForcada = true; // sem o aviso de "alterações não salvas"
				location.href = '/admin/login?expirou=1';
			}
			return resposta;
		};
		return () => (window.fetch = original);
	});
</script>

{#if data.usuario}
	<header class="nao-imprimir">
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
