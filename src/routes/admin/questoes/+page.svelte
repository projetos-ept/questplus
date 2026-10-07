<script lang="ts">
	import { goto, invalidateAll } from '$app/navigation';
	import { untrack } from 'svelte';
	import ConfirmarModal from '#lib/components/ConfirmarModal.svelte';
	import FiltrosQuestoes from '#lib/components/FiltrosQuestoes.svelte';
	import ItemQuestao from '#lib/components/ItemQuestao.svelte';
	import { DISCIPLINAS } from '#lib/disciplinas';
	import { paramsDeFiltro, type FiltroQuestoes } from '#lib/filtros';
	import { montarPromptIA } from '#lib/importacao';
	import { carregarOpcoesPrompt } from '#lib/promptOpcoes';

	let { data } = $props();
	let erro = $state('');
	let aviso = $state('');

	// filtros em tempo real: digitar (com pausa de 300 ms) ou trocar uma opção já refaz a busca, e os filtros se combinam
	let filtro = $state<FiltroQuestoes>(untrack(() => structuredClone($state.snapshot(data.filtro)) as FiltroQuestoes));
	let pausa: ReturnType<typeof setTimeout>;
	function aoMudar(digitando = false) {
		clearTimeout(pausa);
		const ir = () => goto(`?${paramsDeFiltro($state.snapshot(filtro) as FiltroQuestoes)}`, { reset: false, replace: true });
		if (digitando) pausa = setTimeout(ir, 300);
		else ir();
	}

	let promptCopiado = $state(false);
	async function copiarPrompt() {
		try {
			await navigator.clipboard.writeText(montarPromptIA(carregarOpcoesPrompt()));
			promptCopiado = true;
			setTimeout(() => (promptCopiado = false), 2500);
		} catch {
			erro = 'Não consegui copiar. Abra "Importar" e copie a instrução de lá.';
		}
	}

	type Item = (typeof data.itens)[number];
	async function duplicar(q: Item) {
		erro = '';
		const r = await fetch('/api/admin/questoes', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ tipo: q.tipo, enunciado: q.enunciado, config: q.config, explicacao: q.explicacao, pontos: q.pontos, etiquetas: q.etiquetas, ativa: q.ativa })
		});
		const j = (await r.json().catch(() => ({}))) as { id?: number; erros?: string[] };
		if (r.ok) await goto(`/admin/questoes/${j.id}?duplicada=1`);
		else erro = j.erros?.[0] ?? 'Não foi possível duplicar a questão.';
	}
	async function alternar(id: number, ativa: boolean) {
		erro = '';
		const r = await fetch(`/api/admin/questoes/${id}`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ativa }) });
		if (r.ok) await invalidateAll();
		else erro = 'Não foi possível alterar a situação.';
	}

	// ---------- excluir uma ----------
	let alvo = $state<Item | null>(null);
	let modal: ConfirmarModal;
	const resumo = (t: string) => (t.length > 140 ? `${t.slice(0, 140)}…` : t);
	function pedirExclusao(q: Item) {
		alvo = q;
		modal.abrir();
	}
	async function excluir(): Promise<string | void> {
		if (!alvo) return;
		const r = await fetch(`/api/admin/questoes/${alvo.id}`, { method: 'DELETE' });
		if (r.ok) return void (await invalidateAll());
		return ((await r.json().catch(() => ({}))) as { erros?: string[] }).erros?.[0] ?? 'Não foi possível excluir a questão.';
	}

	// ---------- seleção e ações em lote ----------
	let marcadas = $state<Set<number>>(new Set());
	let todasDoFiltro = $state(false);
	const nMarcadas = $derived(todasDoFiltro ? data.total : marcadas.size);
	const todasNaPagina = $derived(data.itens.length > 0 && data.itens.every((q) => marcadas.has(q.id)));
	function marcar(id: number, on: boolean) {
		todasDoFiltro = false;
		const s = new Set(marcadas);
		on ? s.add(id) : s.delete(id);
		marcadas = s;
	}
	function marcarPagina(on: boolean) {
		todasDoFiltro = false;
		const s = new Set(marcadas);
		for (const q of data.itens) on ? s.add(q.id) : s.delete(q.id);
		marcadas = s;
	}
	function desmarcar() {
		marcadas = new Set();
		todasDoFiltro = false;
	}

	let painel = $state<'' | 'add-etiqueta' | 'remover-etiqueta' | 'definir-disciplina'>('');
	let valorAcao = $state('');
	let emLote = $state(false);
	let modalLote: ConfirmarModal;

	async function lote(acao: string, valor?: string): Promise<string | void> {
		erro = '';
		aviso = '';
		emLote = true;
		const corpo = todasDoFiltro ? { filtro: data.consulta, acao, valor } : { ids: [...marcadas], acao, valor };
		const r = await fetch('/api/admin/questoes/lote', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(corpo) });
		const j = (await r.json().catch(() => ({}))) as { afetadas?: number; erros?: string[] };
		emLote = false;
		if (!r.ok) {
			erro = j.erros?.[0] ?? 'Não foi possível concluir a ação em lote.';
			return erro;
		}
		const n = nMarcadas;
		aviso = acao === 'excluir' ? `${j.afetadas} questão(ões) excluída(s)${(j.afetadas ?? 0) < n ? `; ${n - (j.afetadas ?? 0)} ficaram porque estão em atividades` : ''}.` : `${j.afetadas} questão(ões) alterada(s)${(j.afetadas ?? 0) < n ? `; ${n - (j.afetadas ?? 0)} já estavam assim ou não puderam mudar` : ''}.`;
		painel = '';
		valorAcao = '';
		desmarcar();
		await invalidateAll();
	}
	async function aplicarPainel() {
		if (painel && valorAcao.trim()) await lote(painel, valorAcao.trim().toLowerCase());
	}

	const paginas = $derived(Math.max(Math.ceil(data.total / data.limite), 1));
	const link = (pagina: number) => {
		const p = new URLSearchParams(data.consulta);
		if (pagina > 1) p.set('pagina', String(pagina));
		const s = p.toString();
		return s ? `?${s}` : '?';
	};
</script>

<svelte:head><title>Questões · QuestPlus</title></svelte:head>

<div class="topo">
	<h1>Questões <span class="suave">({data.total})</span></h1>
	<div class="topo-acoes">
		<button type="button" class="sec" onclick={copiarPrompt} title="Copia a instrução para a IA gerar o JSON de importação, com as últimas opções usadas em Importar (disciplina, formatos, etiquetas)">{promptCopiado ? 'Instrução copiada ✔' : 'Copiar instrução para IA'}</button>
		<a class="botao sec-link" href="/admin/questoes/importar">Importar</a>
		<a class="botao sec-link" href="/api/admin/questoes/exportar{data.consulta ? `?${data.consulta}` : ''}" download>Exportar JSON{data.consulta ? ' (filtro atual)' : ' (todas)'}</a>
		<a class="botao" href="/admin/questoes/nova">Nova questão</a>
	</div>
</div>

<FiltrosQuestoes bind:filtro facetas={data.facetas} mostrarSituacao onmudou={aoMudar} />

{#if erro}<p class="erro" role="alert">{erro}</p>{/if}
{#if aviso}<p class="aviso" role="status">{aviso}</p>{/if}

<ConfirmarModal bind:this={modal} titulo="Excluir esta questão?" rotuloConfirmar="Excluir questão" perigo bloqueado={(alvo?.em_atividades ?? 0) > 0} onconfirmar={excluir}>
	{#if alvo}
		<p class="resumo">{resumo(alvo.enunciado)}</p>
		<p>Esta ação <strong>não pode ser desfeita</strong>. Provas já respondidas guardam uma cópia da questão e não são afetadas. Para só tirá-la de circulação, use <em>Inativar</em>.</p>
		{#if (alvo.em_atividades ?? 0) > 0}
			<p class="aviso-uso">Esta questão está em <strong>{alvo.em_atividades} atividade(s)</strong> e por isso <strong>não pode ser excluída</strong>. Tire-a das atividades ou use <em>Inativar</em>.</p>
		{/if}
	{/if}
</ConfirmarModal>

<ConfirmarModal bind:this={modalLote} titulo="Excluir as questões escolhidas?" rotuloConfirmar="Excluir {nMarcadas} questão(ões)" perigo onconfirmar={() => lote('excluir')}>
	<p>Serão excluídas até <strong>{nMarcadas} questão(ões)</strong>. Esta ação <strong>não pode ser desfeita</strong>. As que estão em alguma atividade <strong>não são excluídas</strong> (use Inativar para elas). Provas já respondidas guardam uma cópia e não são afetadas.</p>
</ConfirmarModal>

{#if data.itens.length === 0}
	<p class="suave">Nenhuma questão encontrada com esses filtros.</p>
{:else}
	<div class="barra cartao" class:ativa={nMarcadas > 0}>
		<label class="todas"><input type="checkbox" checked={todasNaPagina} onchange={(e) => marcarPagina(e.currentTarget.checked)} /> Marcar esta página</label>
		{#if nMarcadas === 0}
			<span class="suave">Marque questões para ativar, etiquetar, definir a disciplina ou excluir várias de uma vez.</span>
		{:else}
			<strong>{nMarcadas} marcada(s)</strong>
			{#if !todasDoFiltro && data.total > data.itens.length}<button type="button" class="link" onclick={() => (todasDoFiltro = true)}>Marcar as {data.total} do filtro</button>{/if}
			{#if todasDoFiltro}<span class="suave">todas as {data.total} do filtro</span>{/if}
			<button type="button" class="link" onclick={desmarcar}>Desmarcar</button>
			<div class="acoes-lote">
				<button type="button" class="sec" disabled={emLote} onclick={() => lote('ativar')}>Ativar</button>
				<button type="button" class="sec" disabled={emLote} onclick={() => lote('inativar')}>Inativar</button>
				<button type="button" class="sec" onclick={() => ((painel = 'definir-disciplina'), (valorAcao = ''))}>Definir disciplina…</button>
				<button type="button" class="sec" onclick={() => ((painel = 'add-etiqueta'), (valorAcao = ''))}>Adicionar etiqueta…</button>
				<button type="button" class="sec" onclick={() => ((painel = 'remover-etiqueta'), (valorAcao = ''))}>Remover etiqueta…</button>
				<button type="button" class="sec excluir" disabled={emLote} onclick={() => modalLote.abrir()}>Excluir…</button>
			</div>
			{#if painel}
				<form class="painel" onsubmit={(e) => { e.preventDefault(); aplicarPainel(); }}>
					{#if painel === 'definir-disciplina'}
						<label>Disciplina (vira a primeira etiqueta)
							<select bind:value={valorAcao} required>
								<option value="" disabled>Escolha…</option>
								{#each DISCIPLINAS as d}<option value={d.id}>{d.nome}</option>{/each}
							</select>
						</label>
					{:else}
						<label>{painel === 'add-etiqueta' ? 'Etiqueta a adicionar' : 'Etiqueta a remover'}
							<input bind:value={valorAcao} list="etq-banco" required maxlength="40" placeholder="ex.: pre-analitica" />
							<datalist id="etq-banco">{#each data.facetas.etiquetas as e}<option value={e.valor}></option>{/each}</datalist>
						</label>
					{/if}
					<button type="submit" disabled={emLote || !valorAcao}>Aplicar a {nMarcadas}</button>
					<button type="button" class="sec" onclick={() => (painel = '')}>Cancelar</button>
				</form>
			{/if}
		{/if}
	</div>

	<div class="lista">
		{#each data.itens as q (q.id)}
			<ItemQuestao {q}>
				{#snippet inicio()}
					<input type="checkbox" checked={marcadas.has(q.id) || todasDoFiltro} disabled={todasDoFiltro} onchange={(e) => marcar(q.id, e.currentTarget.checked)} aria-label="Marcar esta questão" />
				{/snippet}
				{#snippet acoes()}
					<a class="sec acao-link" href="/admin/questoes/{q.id}">Editar</a>
					<button class="sec" onclick={() => duplicar(q)}>Duplicar</button>
					<button class="sec" onclick={() => alternar(q.id, !q.ativa)}>{q.ativa ? 'Inativar' : 'Ativar'}</button>
					<button class="sec excluir" onclick={() => pedirExclusao(q)}>Excluir</button>
				{/snippet}
			</ItemQuestao>
		{/each}
	</div>
	{#if paginas > 1}
		<p class="paginas">
			{#if data.pagina > 1}<a href={link(data.pagina - 1)}>← Anterior</a>{/if}
			<span class="suave">Página {data.pagina} de {paginas}</span>
			{#if data.pagina < paginas}<a href={link(data.pagina + 1)}>Próxima →</a>{/if}
		</p>
	{/if}
{/if}

<style>
	.topo { display: flex; flex-wrap: wrap; gap: 0.5rem 1rem; align-items: center; justify-content: space-between; }
	.topo-acoes { display: flex; flex-wrap: wrap; gap: 0.5rem; align-items: center; }
	.topo-acoes button { margin: 0; padding: 0.5rem 0.9rem; }
	.sec-link { color: var(--texto); background: transparent; border: 1px solid var(--borda); }
	.botao { padding: 0.55rem 1rem; font-weight: 600; color: var(--sobre-destaque); text-decoration: none; background: var(--destaque); border-radius: 0.4rem; }
	.aviso { padding: 0.5rem 0.75rem; border: 1px solid var(--ok, var(--destaque)); border-radius: 0.4rem; }
	.barra { display: flex; flex-wrap: wrap; gap: 0.5rem 1rem; align-items: center; margin: 0.5rem 0; padding: 0.6rem 0.9rem; }
	.barra.ativa { border-color: var(--destaque); }
	.todas { display: flex; gap: 0.4rem; align-items: center; margin: 0; font-weight: 400; }
	.acoes-lote { display: flex; flex-wrap: wrap; gap: 0.4rem; flex-basis: 100%; }
	.acoes-lote button { margin: 0; padding: 0.3rem 0.7rem; font-size: 0.85rem; }
	.painel { display: flex; flex-wrap: wrap; gap: 0.5rem; align-items: end; flex-basis: 100%; }
	.painel label { margin: 0; min-width: 14rem; }
	.painel button { margin: 0; }
	.link { display: inline; margin: 0; padding: 0; font-weight: 400; color: var(--destaque); text-decoration: underline; background: none; border: 0; }
	.acao-link { display: inline-block; font-weight: 600; color: var(--texto); text-decoration: none; border: 1px solid var(--borda); border-radius: 0.4rem; }
	.excluir { color: var(--erro); border-color: var(--erro); }
	.resumo { padding: 0.5rem 0.75rem; overflow-wrap: anywhere; background: var(--fundo); border-radius: 0.4rem; }
	.paginas { display: flex; gap: 1rem; align-items: center; justify-content: center; }
	.aviso-uso { padding: 0.5rem 0.75rem; border: 1px solid var(--erro); border-radius: 0.4rem; }
</style>
