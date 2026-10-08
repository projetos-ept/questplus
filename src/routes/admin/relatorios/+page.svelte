<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { untrack } from 'svelte';
	import { formatarUmaCasa } from '#lib/relatorio';

	let { data } = $props();

	type Situacao = 'todas' | 'com' | 'pendentes';
	// busca, turma, situação e ordem ficam na URL (voltar do relatório devolve o mesmo filtro)
	let busca = $state(untrack(() => page.url.searchParams.get('q') ?? ''));
	let turma = $state(untrack(() => page.url.searchParams.get('turma') ?? ''));
	let situacao = $state<Situacao>(untrack(() => (['com', 'pendentes'].includes(page.url.searchParams.get('s') ?? '') ? (page.url.searchParams.get('s') as Situacao) : 'todas')));
	let ordem = $state(untrack(() => page.url.searchParams.get('ordem') ?? 'recentes'));

	const turmas = $derived([...new Set(data.atividades.flatMap((a) => a.turmas))].sort((a, b) => a.localeCompare(b, 'pt-BR')));
	const norm = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
	const q = $derived(norm(busca.trim()));

	const lista = $derived(
		data.atividades
			.filter((a) => (!q || norm(a.titulo).includes(q)) && (!turma || a.turmas.includes(turma)) && (situacao === 'todas' || (situacao === 'com' && a.alunos > 0) || (situacao === 'pendentes' && a.abertas_pendentes > 0)))
			.toSorted((a, b) => (ordem === 'titulo' ? a.titulo.localeCompare(b.titulo, 'pt-BR') : ordem === 'alunos' ? b.alunos - a.alunos : b.id - a.id))
	);

	$effect(() => {
		const p = new URLSearchParams();
		if (busca.trim()) p.set('q', busca.trim());
		if (turma) p.set('turma', turma);
		if (situacao !== 'todas') p.set('s', situacao);
		if (ordem !== 'recentes') p.set('ordem', ordem);
		const alvo = p.size ? `?${p}` : location.pathname;
		untrack(() => goto(alvo, { replace: true, reset: false }));
	});

	function limpar() {
		busca = '';
		turma = '';
		situacao = 'todas';
	}
	const estado = { no_prazo: ['Aberta', 'aberta'], antes: ['Ainda não abriu', 'enc'], encerrada: ['Encerrada', 'enc'], inativa: ['Inativa', 'inat'] } as const;
	const pct = (n: number | null) => (n === null ? '—' : `${String(n).replace('.', ',')}%`);
	function marcar(texto: string) {
		const i = q ? norm(texto).indexOf(q) : -1;
		return i < 0 ? [{ t: texto, m: false }] : [{ t: texto.slice(0, i), m: false }, { t: texto.slice(i, i + q.length), m: true }, { t: texto.slice(i + q.length), m: false }];
	}
</script>

<svelte:head><title>Relatórios · QuestPlus</title></svelte:head>

<h1>Relatórios</h1>
<p class="suave">Escolha a atividade para ver notas, aproveitamento por questão e relatórios individuais.</p>

<section class="cartao" aria-label="Filtros">
	<div class="filtros">
		<div class="campo-busca">
			<label for="busca">Buscar pelo título</label>
			<input id="busca" type="search" placeholder="Ex.: unidade, hematologia, CIQ…" autocomplete="off" bind:value={busca} aria-controls="lista" aria-describedby="contagem" />
			{#if busca}<button type="button" class="limpar-x sec" aria-label="Limpar busca" onclick={() => (busca = '')}>✕</button>{/if}
		</div>
		<div>
			<label for="turma">Turma</label>
			<select id="turma" bind:value={turma} aria-controls="lista">
				<option value="">Todas as turmas</option>
				{#each turmas as t}<option value={t}>{t}</option>{/each}
			</select>
		</div>
		<button type="button" class="sec" onclick={limpar}>Limpar filtros</button>
	</div>
	<div class="abas" role="group" aria-label="Situação da atividade">
		{#each [['todas', 'Todas'], ['com', 'Com tentativas'], ['pendentes', 'Com abertas a corrigir']] as [v, rot]}
			<button type="button" class="sec" aria-pressed={situacao === v} onclick={() => (situacao = v as Situacao)}>{rot}</button>
		{/each}
	</div>
</section>

<div class="contagem">
	<p class="suave" id="contagem" role="status" aria-live="polite">
		{lista.length} de {data.atividades.length} atividade(s){turma ? ` · turma ${turma}` : ''}{busca.trim() ? ` · busca “${busca.trim()}”` : ''}
	</p>
	<label class="ordem suave">Ordenar
		<select bind:value={ordem}>
			<option value="recentes">Mais recentes</option>
			<option value="titulo">Título (A–Z)</option>
			<option value="alunos">Mais alunos</option>
		</select>
	</label>
</div>

<ul class="lista" id="lista">
	{#each lista as a (a.id)}
		<li class="cartao item">
			<div>
				<h2><a href="/admin/atividades/{a.id}/relatorio">{#each marcar(a.titulo) as parte}{#if parte.m}<mark>{parte.t}</mark>{:else}{parte.t}{/if}{/each}</a></h2>
				{#if a.componente}<p class="comp">{a.componente}</p>{/if}
				<div class="chips">
					<span class="chip e-{estado[a.estado][1]}">{estado[a.estado][0]}</span>
					{#each a.turmas as t}<span class="chip">{t}</span>{/each}
				</div>
			</div>
			<div class="metricas">
				<div><b>{a.alunos}</b><small>alunos</small></div>
				<div><b>{pct(a.media)}</b><small>média</small></div>
				{#if a.peso !== null}<div><b class="peso">{formatarUmaCasa(a.peso)}</b><small>peso</small></div>{/if}
			</div>
			<div>{#if a.abertas_pendentes > 0}<span class="pend">⚠ {a.abertas_pendentes} aberta(s) a corrigir</span>{:else}<span class="suave">código <code>{a.codigo}</code></span>{/if}</div>
			<div class="acoes">
				<a class="botao" href="/admin/atividades/{a.id}/relatorio">Relatório</a>
				<a class="botao sec" href="/admin/atividades/{a.id}/relatorios">Individuais</a>
				{#if a.abertas_pendentes > 0}<a class="botao sec" href="/admin/atividades/{a.id}/abertas">Corrigir abertas</a>{/if}
			</div>
		</li>
	{:else}
		<li class="cartao vazio">
			<p><strong>Nenhuma atividade encontrada.</strong></p>
			<p class="suave">Tente outro título ou outra turma.</p>
			<button type="button" class="sec" onclick={limpar}>Limpar filtros</button>
		</li>
	{/each}
</ul>

<style>
	.cartao { margin-top: var(--espaco); }
	.filtros { display: grid; grid-template-columns: minmax(0, 2fr) minmax(0, 1fr) auto; gap: 12px; align-items: end; }
	.filtros label { margin: 0; }
	.filtros button { margin: 0; }
	.campo-busca { position: relative; }
	.campo-busca input { padding-right: 2.4rem; }
	.campo-busca input::-webkit-search-cancel-button { display: none; }
	.limpar-x { position: absolute; right: 4px; bottom: 3px; min-height: 34px; min-width: 34px; margin: 0; padding: 0; color: var(--texto-secundario); border: 0; box-shadow: none; }
	.abas { display: flex; flex-wrap: wrap; gap: 0.5rem; margin-top: 14px; }
	.abas button { margin: 0; padding: 0.3rem 0.85rem; font-size: var(--escala-sm); }
	.abas button[aria-pressed='true'] { color: var(--sobre-primaria); background: var(--primaria); box-shadow: var(--sombra-interna); }
	.contagem { display: flex; flex-wrap: wrap; gap: 0.25rem 1rem; justify-content: space-between; align-items: center; margin: 14px 0 8px; }
	.contagem p { margin: 0; }
	.ordem { display: flex; gap: 0.4rem; align-items: center; margin: 0; font-weight: 400; }
	.ordem select { width: auto; min-height: 34px; margin: 0; }
	.lista { display: grid; gap: 14px; padding: 0; margin: 0; list-style: none; }
	.lista .cartao { margin: 0; }
	.item { display: grid; grid-template-columns: minmax(0, 2.2fr) minmax(0, 1.3fr) minmax(0, 1.1fr) auto; gap: 10px 18px; align-items: center; }
	.item h2 { margin: 0; font-size: 1.02rem; }
	.item h2 a { color: var(--texto); text-decoration: none; }
	.item h2 a:hover { color: var(--primaria); text-decoration: underline; }
	.comp { margin: 0; font-size: var(--escala-sm); color: var(--texto-secundario); }
	.chips { display: flex; flex-wrap: wrap; gap: 0.3rem; margin-top: 0.4rem; }
	.chip { display: inline-block; padding: 0 0.55rem; font-size: var(--escala-xs); border: 1px solid var(--borda); border-radius: 99px; background: var(--fundo); }
	.e-aberta { color: var(--sucesso); border-color: var(--sucesso); }
	.e-inat { color: var(--alerta); border-color: var(--alerta); }
	.metricas { display: flex; gap: 16px; }
	.metricas b { display: block; font-size: 1.15rem; letter-spacing: var(--tracking); }
	.metricas small { font-size: var(--escala-xs); color: var(--texto-secundario); }
	.peso { color: var(--secundaria); }
	.pend { font-size: var(--escala-sm); font-weight: var(--peso-acao); color: var(--alerta); }
	.acoes { display: flex; flex-wrap: wrap; gap: 0.4rem; justify-content: flex-end; }
	.botao { display: inline-flex; align-items: center; min-height: var(--altura-controle); padding: 0 1rem; font-weight: var(--peso-acao); color: var(--sobre-primaria); text-decoration: none; background: var(--primaria); border: 1px solid var(--primaria); border-radius: calc(var(--raio) / 2); box-shadow: 3px 3px 8px color-mix(in srgb, var(--texto) 18%, transparent), -3px -3px 8px var(--superficie); transition: transform var(--transicao) var(--easing), box-shadow var(--transicao) var(--easing); }
	.botao.sec { color: var(--primaria); background: var(--superficie); box-shadow: none; }
	.botao:hover { transform: translateY(var(--deslocamento-hover)); box-shadow: var(--sombra-hover); }
	.botao:active { transform: translateY(1px); }
	mark { color: inherit; background: color-mix(in srgb, var(--primaria) 16%, var(--superficie)); border-radius: 3px; }
	.vazio { text-align: center; }
	@media (max-width: 960px) {
		.item { grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); }
		.item .acoes { grid-column: 1 / -1; justify-content: flex-start; }
	}
	@media (max-width: 640px) {
		.filtros { grid-template-columns: minmax(0, 1fr); }
		.item { grid-template-columns: minmax(0, 1fr); }
		.acoes, .botao { width: 100%; }
		.botao { justify-content: center; flex: 1; }
	}
</style>
