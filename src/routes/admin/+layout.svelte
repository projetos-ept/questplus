<script lang="ts">
	import { page } from '$app/state';
	import { onMount } from 'svelte';
	let { data, children } = $props();

	const links = [
		{ href: '/admin', nome: 'Painel' },
		{ href: '/admin/questoes', nome: 'Questões' },
		{ href: '/admin/suportes', nome: 'Textos de apoio' },
		{ href: '/admin/turmas', nome: 'Turmas' },
		{ href: '/admin/atividades', nome: 'Atividades' },
		{ href: '/admin/relatorios', nome: 'Relatórios' }
	];
	const atual = (href: string) => {
		const c = page.url.pathname;
		if (href === '/admin') return c === '/admin';
		// o relatório individual de um aluno (/admin/tentativas/…) também pertence a Relatórios
		if (href === '/admin/relatorios' && c.startsWith('/admin/tentativas/')) return true;
		return c === href || c.startsWith(`${href}/`);
	};

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
			{#each links as l (l.href)}
				<a href={l.href} aria-current={atual(l.href) ? 'page' : undefined}>{l.nome}</a>
			{/each}
		</nav>
		<div class="direita">
			<a class="perfil" href="/admin/perfil" aria-current={page.url.pathname === '/admin/perfil' ? 'page' : undefined}>Perfil</a>
			<form method="POST" action="/admin/sair"><button type="submit" class="sec">Sair</button></form>
		</div>
	</header>
	<div class="conteudo">{@render children()}</div>
{:else}
	{@render children()}
{/if}

<style>
	header {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem 1rem;
		align-items: center;
		justify-content: space-between;
		max-width: 72rem;
		margin: var(--espaco) auto 0;
		padding: 0.6rem 1rem;
		background: var(--superficie);
		border: var(--borda-espessura) var(--borda-estilo) var(--borda-cor);
		border-radius: var(--raio);
		box-shadow: var(--sombra);
	}
	nav {
		display: flex;
		flex-wrap: wrap;
		gap: 0.35rem;
	}
	nav a {
		display: inline-flex;
		align-items: center;
		min-height: var(--altura-controle);
		padding: 0 0.9rem;
		font-weight: var(--peso-acao);
		color: var(--texto);
		text-decoration: none;
		border-radius: calc(var(--raio) / 2);
		transition: background var(--transicao) var(--easing), box-shadow var(--transicao) var(--easing);
	}
	nav a:hover { background: var(--fundo); }
	nav a[aria-current='page'] { color: var(--sobre-primaria); background: var(--primaria); box-shadow: var(--sombra-interna); }
	.direita {
		display: flex;
		gap: 0.5rem;
		align-items: center;
	}
	.perfil { display: inline-flex; align-items: center; min-height: var(--altura-controle); padding: 0 0.9rem; font-weight: var(--peso-acao); color: var(--texto); text-decoration: none; border-radius: calc(var(--raio) / 2); }
	.perfil:hover { background: var(--fundo); }
	.perfil[aria-current='page'] { color: var(--sobre-primaria); background: var(--primaria); box-shadow: var(--sombra-interna); }
	.direita :global(button) {
		margin: 0;
		padding: 0.35rem 0.9rem;
		font-size: var(--escala-sm);
	}
	.conteudo {
		max-width: 72rem;
		margin: 0 auto;
		padding: 1.5rem 1rem 3rem;
	}
	@media (max-width: 640px) {
		header { margin: 0.5rem 0.5rem 0; }
		nav a { padding: 0 0.6rem; }
	}
</style>
