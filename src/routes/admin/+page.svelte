<script lang="ts">
	let { data } = $props();
	const n = $derived(data.numeros);
	// passo a passo para quem está começando: cada passo some quando o sistema já tem o que ele pede
	const passos = $derived([
		{ feito: n.turmas > 0, texto: 'Cadastre ao menos uma turma', href: '/admin/turmas' },
		{ feito: n.questoes > 0, texto: 'Crie ou importe questões', href: '/admin/questoes' },
		{ feito: n.atividades > 0, texto: 'Monte uma atividade e copie o link', href: '/admin/atividades/nova' },
		{ feito: n.finalizadas > 0, texto: 'Passe o link aos alunos e acompanhe as respostas', href: '/admin/atividades' }
	]);
	const comecando = $derived(passos.some((p) => !p.feito));
</script>

<svelte:head><title>Painel · QuestPlus</title></svelte:head>

<h1>Painel</h1>

{#if comecando}
	<section class="cartao comeco" aria-label="Primeiros passos">
		<h2>Primeiros passos</h2>
		<ol>
			{#each passos as p}
				<li class:feito={p.feito}>{p.feito ? '✔' : '○'} <a href={p.href}>{p.texto}</a>{p.feito ? ' — feito' : ''}</li>
			{/each}
		</ol>
	</section>
{/if}

<div class="grade">
	<a class="cartao" href="/admin/questoes"><span class="rot">Questões ativas</span><strong>{n.questoes}</strong><span class="suave">Banco de questões, importar e exportar</span></a>
	<a class="cartao" href="/admin/suportes"><span class="rot">Textos de apoio</span><strong>{n.suportes}</strong><span class="suave">Texto e até 10 imagens por texto</span></a>
	<a class="cartao" href="/admin/turmas"><span class="rot">Turmas ativas</span><strong>{n.turmas}</strong><span class="suave">Lista que o aluno vê ao entrar</span></a>
	<a class="cartao" href="/admin/atividades"><span class="rot">Atividades</span><strong>{n.atividades}</strong><span class="suave">{data.abertas.length} aberta(s) agora</span></a>
	<div class="cartao"><span class="rot">Tentativas finalizadas</span><strong>{n.finalizadas}</strong><span class="suave">{n.ultimas24h} nas últimas 24 h · {n.andamento} em andamento</span></div>
</div>

<h2>Atividades abertas agora</h2>
{#if data.abertas.length === 0}
	<p class="suave">Nenhuma atividade aberta no momento. <a href="/admin/atividades">Ver todas</a></p>
{:else}
	<div class="rolagem">
		<table>
			<thead><tr><th>Atividade</th><th>Código</th><th>Tentativas</th><th></th></tr></thead>
			<tbody>
				{#each data.abertas as a (a.id)}
					<tr>
						<td><a href="/admin/atividades/{a.id}">{a.titulo}</a></td>
						<td><code>{a.codigo}</code></td>
						<td>{a.n_tentativas}</td>
						<td><a href="/admin/atividades/{a.id}/relatorio">Relatório</a></td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
{/if}

<style>
	h2 { margin: 1.5rem 0 0.5rem; font-size: 1.1rem; }
	.comeco { border-color: var(--destaque); }
	.comeco h2 { margin-top: 0; }
	.comeco ol { margin: 0.25rem 0 0; padding-left: 0; list-style: none; }
	.comeco li { padding: 0.2rem 0; }
	.comeco li.feito { color: var(--suave); }
	.grade { display: grid; grid-template-columns: repeat(auto-fit, minmax(13rem, 1fr)); gap: 1rem; margin-top: 1rem; }
	.grade .cartao { display: flex; flex-direction: column; gap: 0.15rem; color: inherit; text-decoration: none; }
	.grade a.cartao:hover { border-color: var(--destaque); }
	.grade strong { font-size: 1.8rem; }
	.rot { font-size: 0.8rem; font-weight: 600; color: var(--suave); }
	.rolagem { overflow-x: auto; }
</style>
