<script lang="ts">
	import { untrack } from 'svelte';
	import { filtroVazio, paramsDeFiltro, type FiltroQuestoes } from '#lib/filtros';
	import { sortear } from '#lib/sorteio';
	import FiltrosQuestoes, { type Facetas } from './FiltrosQuestoes.svelte';
	import ItemQuestao, { type QuestaoItem } from './ItemQuestao.svelte';

	export type Escolhida = { id: number; tipo: string; enunciado: string; pontos: number };

	let { selecionadas, vagas, onadicionar }: { selecionadas: Set<number>; vagas: number; onadicionar: (itens: Escolhida[]) => void } = $props();

	const POR_PAGINA = 20;
	let filtro = $state<FiltroQuestoes>({ ...filtroVazio(), ativa: '1' });
	let facetas = $state<Facetas | null>(null);
	let achadas = $state<QuestaoItem[]>([]);
	let total = $state(0);
	let buscando = $state(false);
	let ocupado = $state(false);
	let erro = $state('');
	let aviso = $state('');
	let marcadas = $state<Set<number>>(new Set());
	let temporizador: ReturnType<typeof setTimeout>;
	let consulta: AbortController | undefined;

	const url = (base: string, extra: Record<string, string | number> = {}) => `/api/admin/questoes${base}?${paramsDeFiltro($state.snapshot(filtro) as FiltroQuestoes, extra)}`;
	const novas = $derived(achadas.filter((q) => !selecionadas.has(q.id)));
	const marcaveis = $derived(novas.filter((q) => marcadas.has(q.id)));

	/** Refaz a busca do zero; a consulta anterior ainda em andamento é cancelada, então só vale a mais recente. */
	async function buscar() {
		consulta?.abort();
		consulta = new AbortController();
		buscando = true;
		erro = '';
		try {
			const [r, f] = await Promise.all([
				fetch(url('', { limite: POR_PAGINA, offset: 0 }), { signal: consulta.signal }),
				fetch(url('/facetas'), { signal: consulta.signal })
			]);
			if (!r.ok || !f.ok) throw new Error();
			const j = (await r.json()) as { itens: QuestaoItem[]; total: number };
			achadas = j.itens;
			total = j.total;
			facetas = (await f.json()) as Facetas;
			marcadas = new Set();
			buscando = false;
		} catch (e) {
			if ((e as Error).name === 'AbortError') return;
			erro = 'Não foi possível buscar as questões.';
			buscando = false;
		}
	}
	async function maisResultados() {
		buscando = true;
		try {
			const r = await fetch(url('', { limite: POR_PAGINA, offset: achadas.length }));
			const j = (await r.json()) as { itens: QuestaoItem[]; total: number };
			achadas = [...achadas, ...j.itens];
			total = j.total;
		} catch {
			erro = 'Não foi possível carregar mais questões.';
		}
		buscando = false;
	}
	function aoMudar(digitando = false) {
		clearTimeout(temporizador);
		temporizador = setTimeout(buscar, digitando ? 250 : 0);
	}
	$effect(() => {
		untrack(buscar);
	});

	const paraEscolhida = (q: { id: number; tipo: string; enunciado: string; pontos: number }): Escolhida => ({ id: q.id, tipo: q.tipo, enunciado: q.enunciado, pontos: q.pontos });
	function adicionar(itens: Escolhida[], mensagem?: string) {
		const lista = itens.filter((q) => !selecionadas.has(q.id)).slice(0, vagas);
		if (lista.length) onadicionar(lista);
		marcadas = new Set();
		aviso = mensagem ?? (lista.length ? `${lista.length} questão(ões) adicionada(s).` : 'Nenhuma questão nova para adicionar.');
		if (lista.length < itens.length && vagas < itens.length) aviso += ` O limite de 100 por atividade cortou ${itens.length - lista.length}.`;
	}
	function marcar(id: number, on: boolean) {
		const s = new Set(marcadas);
		on ? s.add(id) : s.delete(id);
		marcadas = s;
	}

	/** Tudo o que o filtro encontra (até 500), em versão enxuta, sem as já adicionadas. */
	async function doFiltro(): Promise<{ itens: (Escolhida & { etiquetas: string[] })[]; limitado: boolean } | null> {
		ocupado = true;
		erro = '';
		try {
			const r = await fetch(url('/resumo'));
			if (!r.ok) throw new Error();
			const j = (await r.json()) as { itens: (Escolhida & { etiquetas: string[] })[]; limitado: boolean };
			return { ...j, itens: j.itens.filter((q) => !selecionadas.has(q.id)) };
		} catch {
			erro = 'Não foi possível consultar o filtro.';
			return null;
		} finally {
			ocupado = false;
		}
	}
	async function adicionarTodas() {
		const j = await doFiltro();
		if (j) adicionar(j.itens, `${Math.min(j.itens.length, vagas)} questão(ões) do filtro adicionada(s).${j.limitado ? ' O filtro tem mais de 500; só as 500 primeiras foram consideradas.' : ''}`);
	}

	// ---------- sortear ----------
	let quantos = $state(10);
	let equilibrar = $state(true);
	async function sortearN() {
		const n = Math.max(1, Math.min(Math.floor(quantos) || 1, vagas));
		const j = await doFiltro();
		if (!j) return;
		if (!j.itens.length) return void (aviso = 'Nenhuma questão nova no filtro para sortear.');
		const sorteadas = sortear(j.itens, n, equilibrar ? (q) => q.etiquetas[0] ?? '' : undefined);
		adicionar(sorteadas, `${sorteadas.length} questão(ões) sorteada(s) do filtro${equilibrar ? ', distribuídas entre as disciplinas' : ''}. Confira na lista acima; dá para remover ou sortear de novo.`);
	}
</script>

<div class="seletor">
	<strong>Adicionar questões</strong>
	<FiltrosQuestoes bind:filtro {facetas} onmudou={aoMudar} />

	<p class="suave status" aria-live="polite">
		{#if buscando}Buscando…{:else}{total} questão(ões) ativa(s) encontrada(s){#if novas.length < achadas.length} · {achadas.length - novas.length} já está(ão) na atividade{/if}.{/if}
	</p>
	{#if erro}<p class="erro" role="alert">{erro}</p>{/if}
	{#if aviso}<p class="aviso" role="status">{aviso}</p>{/if}

	<div class="barra cartao">
		<div class="grupo">
			<button type="button" class="sec" disabled={!marcaveis.length || vagas === 0} onclick={() => adicionar(marcaveis.map(paraEscolhida))}>Adicionar marcadas ({marcaveis.length})</button>
			<button type="button" class="sec" disabled={!novas.length} onclick={() => (marcadas = new Set(novas.map((q) => q.id)))}>Marcar as {novas.length} visíveis</button>
			<button type="button" class="sec" disabled={ocupado || buscando || total === 0 || vagas === 0} onclick={adicionarTodas}>Adicionar todas as {total} do filtro</button>
		</div>
		<!-- não pode ser <form>: este seletor fica dentro do formulário da atividade (form dentro de form quebra a hidratação) -->
		<div class="grupo sorteio" role="group" aria-label="Sortear questões do filtro">
			<label>Sortear <input type="number" min="1" max={vagas || 1} bind:value={quantos} onkeydown={(e) => { if (e.key === 'Enter') { e.preventDefault(); sortearN(); } }} /> do filtro</label>
			<label class="check"><input type="checkbox" bind:checked={equilibrar} /> igual entre disciplinas</label>
			<button type="button" class="sec" onclick={sortearN} disabled={ocupado || buscando || total === 0 || vagas === 0}>🎲 Sortear</button>
		</div>
		{#if vagas === 0}<span class="erro">A atividade já tem 100 questões (o máximo).</span>{:else}<span class="suave">Cabem mais {vagas}.</span>{/if}
	</div>

	<div class="lista" aria-busy={buscando}>
		{#each novas as q (q.id)}
			<ItemQuestao {q}>
				{#snippet inicio()}
					<input type="checkbox" checked={marcadas.has(q.id)} onchange={(e) => marcar(q.id, e.currentTarget.checked)} aria-label="Marcar para adicionar" />
				{/snippet}
				{#snippet acoes()}
					<button type="button" class="sec" disabled={vagas === 0} onclick={() => adicionar([paraEscolhida(q)])}>Adicionar</button>
				{/snippet}
			</ItemQuestao>
		{:else}
			{#if !buscando}<p class="suave">Nenhuma questão para adicionar com esses filtros.</p>{/if}
		{/each}
	</div>
	{#if achadas.length < total}
		<button type="button" class="sec mais" onclick={maisResultados} disabled={buscando}>Carregar mais ({total - achadas.length} restantes)</button>
	{/if}
</div>

<style>
	.seletor { margin-top: 1.25rem; padding-top: 1rem; border-top: 1px solid var(--borda); }
	.status { margin: 0.5rem 0; }
	.aviso { padding: 0.5rem 0.75rem; border: 1px solid var(--sucesso, var(--primaria)); border-radius: 0.4rem; }
	.barra { display: flex; flex-wrap: wrap; gap: 0.6rem 1.25rem; align-items: center; padding: 0.6rem 0.9rem; }
	.grupo { display: flex; flex-wrap: wrap; gap: 0.4rem 0.6rem; align-items: center; }
	.grupo button { margin: 0; padding: 0.35rem 0.8rem; font-size: 0.9rem; }
	.sorteio label { display: flex; gap: 0.4rem; align-items: center; margin: 0; font-weight: 400; }
	.sorteio input[type='number'] { width: 4.5rem; margin: 0; }
	.check { gap: 0.35rem; }
	.mais { margin: 0.75rem 0 0; }
</style>
