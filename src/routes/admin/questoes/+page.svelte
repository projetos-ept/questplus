<script lang="ts">
	import { goto, invalidateAll } from '$app/navigation';
	import { untrack } from 'svelte';
	import ConfirmarModal from '#lib/components/ConfirmarModal.svelte';
	import { OPCOES_PROMPT_PADRAO, montarPromptIA } from '#lib/importacao';
	import { formatoDe } from '#lib/questao';

	let { data } = $props();
	let erro = $state('');

	// filtros em tempo real: digitar (com pausa de 300 ms) ou trocar uma lista já refaz a busca, sem botão
	let fq = $state(untrack(() => data.filtros.q));
	let ftipo = $state(untrack(() => data.filtros.tipo));
	let fetiqueta = $state(untrack(() => data.filtros.etiqueta));
	let fativa = $state(untrack(() => data.filtros.ativa));
	let pausa: ReturnType<typeof setTimeout>;

	function aplicar() {
		const p = new URLSearchParams();
		if (fq.trim()) p.set('q', fq.trim());
		if (ftipo) p.set('tipo', ftipo);
		if (fetiqueta) p.set('etiqueta', fetiqueta);
		if (fativa) p.set('ativa', fativa);
		goto(`?${p}`, { reset: false, replace: true });
	}
	function aoDigitar() {
		clearTimeout(pausa);
		pausa = setTimeout(aplicar, 300);
	}
	function limpar() {
		fq = ftipo = fetiqueta = fativa = '';
		aplicar();
	}
	let promptCopiado = $state(false);
	let alvo = $state<(typeof data.itens)[number] | null>(null);

	async function copiarPrompt() {
		try {
			await navigator.clipboard.writeText(montarPromptIA(OPCOES_PROMPT_PADRAO));
			promptCopiado = true;
			setTimeout(() => (promptCopiado = false), 2500);
		} catch {
			erro = 'Não consegui copiar. Abra "Importar" e copie a instrução de lá.';
		}
	}

	const filtrosExportar = $derived.by(() => {
		const p = new URLSearchParams();
		if (fq.trim()) p.set('q', fq.trim());
		if (ftipo) p.set('tipo', ftipo);
		if (fetiqueta) p.set('etiqueta', fetiqueta);
		if (fativa) p.set('ativa', fativa);
		return p.toString();
	});
	let modal: ConfirmarModal;

	function pedirExclusao(q: (typeof data.itens)[number]) {
		alvo = q;
		modal.abrir();
	}

	/** Devolve a mensagem de erro (fica no modal) ou nada, quando excluiu. */
	async function excluir(): Promise<string | void> {
		if (!alvo) return;
		const r = await fetch(`/api/admin/questoes/${alvo.id}`, { method: 'DELETE' });
		if (r.ok) return void (await invalidateAll());
		return ((await r.json().catch(() => ({}))) as { erros?: string[] }).erros?.[0] ?? 'Não foi possível excluir a questão.';
	}

	const paginas = $derived(Math.max(Math.ceil(data.total / data.limite), 1));
	const resumo = (t: string) => (t.length > 140 ? `${t.slice(0, 140)}…` : t);
	const link = (pagina: number) => {
		const p = new URLSearchParams();
		for (const [k, v] of Object.entries(data.filtros)) if (v) p.set(k, v);
		if (pagina > 1) p.set('pagina', String(pagina));
		const s = p.toString();
		return s ? `?${s}` : '?';
	};

	async function alternar(id: number, ativa: boolean) {
		erro = '';
		const r = await fetch(`/api/admin/questoes/${id}`, {
			method: 'PATCH',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ ativa })
		});
		if (r.ok) await invalidateAll();
		else erro = 'Não foi possível alterar a situação.';
	}
</script>

<svelte:head><title>Questões · QuestPlus</title></svelte:head>

<div class="topo">
	<h1>Questões <span class="suave">({data.total})</span></h1>
	<div class="topo-acoes">
		<button type="button" class="sec" onclick={copiarPrompt} title="Copia a instrução que ensina uma IA a gerar o JSON de importação">{promptCopiado ? 'Instrução copiada ✔' : 'Copiar instrução para IA'}</button>
		<a class="botao sec-link" href="/admin/questoes/importar">Importar</a>
		<a class="botao sec-link" href="/api/admin/questoes/exportar{filtrosExportar ? `?${filtrosExportar}` : ''}" download>Exportar JSON{filtrosExportar ? ' (filtro atual)' : ' (todas)'}</a>
		<a class="botao" href="/admin/questoes/nova">Nova questão</a>
	</div>
</div>

<form method="GET" class="filtros cartao" onsubmit={(e) => { e.preventDefault(); clearTimeout(pausa); aplicar(); }}>
	<label>Busca <input name="q" bind:value={fq} oninput={aoDigitar} placeholder="Trecho do enunciado" type="search" /></label>
	<label>Formato
		<select name="tipo" bind:value={ftipo} onchange={aplicar}>
			<option value="">Todos</option>
			<option value="mc">Múltipla escolha</option>
			<option value="vf">Verdadeiro ou falso</option>
		</select>
	</label>
	<label>Etiqueta
		<select name="etiqueta" bind:value={fetiqueta} onchange={aplicar}>
			<option value="">Todas</option>
			{#each data.etiquetas as e}<option value={e}>{e}</option>{/each}
		</select>
	</label>
	<label>Situação
		<select name="ativa" bind:value={fativa} onchange={aplicar}>
			<option value="">Todas</option>
			<option value="1">Ativas</option>
			<option value="0">Inativas</option>
		</select>
	</label>
	{#if fq || ftipo || fetiqueta || fativa}<button type="button" class="sec" onclick={limpar}>Limpar filtros</button>{/if}
	<noscript><button type="submit">Filtrar</button></noscript>
</form>

{#if erro}<p class="erro" role="alert">{erro}</p>{/if}

<ConfirmarModal bind:this={modal} titulo="Excluir esta questão?" rotuloConfirmar="Excluir questão" perigo onconfirmar={excluir}>
	{#if alvo}
		<p class="resumo">{resumo(alvo.enunciado)}</p>
		<p>Esta ação <strong>não pode ser desfeita</strong>. Provas já respondidas guardam uma cópia da questão e não são afetadas. Para só tirá-la de circulação, use <em>Inativar</em>.</p>
	{/if}
</ConfirmarModal>

{#if data.itens.length === 0}
	<p class="suave">Nenhuma questão encontrada.</p>
{:else}
	<div class="rolagem">
		<table>
			<thead><tr><th>Formato</th><th>Enunciado</th><th>Pontos</th><th>Situação</th><th></th></tr></thead>
			<tbody>
				{#each data.itens as q (q.id)}
					<tr class:inativa={!q.ativa}>
						<td>{formatoDe(q.tipo, q.config)}</td>
						<td>
							<a href="/admin/questoes/{q.id}">{resumo(q.enunciado)}</a>
							<div>{#each q.etiquetas as e}<span class="etiqueta">{e}</span>{/each}</div>
						</td>
						<td>{q.pontos}</td>
						<td>{q.ativa ? 'Ativa' : 'Inativa'}</td>
						<td class="botoes">
							<button class="sec" onclick={() => alternar(q.id, !q.ativa)}>{q.ativa ? 'Inativar' : 'Ativar'}</button>
							<button class="sec excluir" onclick={() => pedirExclusao(q)}>Excluir</button>
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
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
	.topo {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem 1rem;
		align-items: center;
		justify-content: space-between;
	}
	.topo-acoes { display: flex; flex-wrap: wrap; gap: 0.5rem; align-items: center; }
	.topo-acoes button { margin: 0; padding: 0.5rem 0.9rem; }
	.sec-link { color: var(--texto); background: transparent; border: 1px solid var(--borda); }
	.botao {
		padding: 0.55rem 1rem;
		font-weight: 600;
		color: var(--sobre-destaque);
		text-decoration: none;
		background: var(--destaque);
		border-radius: 0.4rem;
	}
	.filtros {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(10rem, 1fr));
		gap: 0 0.75rem;
		align-items: end;
		margin: 1rem 0;
	}
	.filtros button {
		margin-top: 1rem;
	}
	.rolagem {
		overflow-x: auto;
	}
	tr.inativa td {
		opacity: 0.6;
	}
	td button {
		margin: 0 0.25rem 0 0;
		padding: 0.3rem 0.6rem;
		font-size: 0.85rem;
	}
	.botoes {
		white-space: nowrap;
	}
	.excluir {
		color: var(--erro);
		border-color: var(--erro);
	}
	.resumo {
		padding: 0.5rem 0.75rem;
		overflow-wrap: anywhere;
		background: var(--fundo);
		border-radius: 0.4rem;
	}
	.paginas {
		display: flex;
		gap: 1rem;
		align-items: center;
		justify-content: center;
	}
</style>
