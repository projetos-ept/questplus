<script lang="ts">
	import { goto, invalidateAll } from '$app/navigation';
	import { untrack } from 'svelte';
	import ConfirmarModal from '#lib/components/ConfirmarModal.svelte';
	import FiltrosQuestoes from '#lib/components/FiltrosQuestoes.svelte';
	import { DISCIPLINAS, ehDisciplina, nomeDaDisciplina } from '#lib/disciplinas';
	import { paramsDeFiltro, type FiltroQuestoes } from '#lib/filtros';
	import { montarPromptSuporteIA } from '#lib/importacao-suportes';
	import { carregarOpcoesPromptSuporte } from '#lib/promptOpcoes';

	let { data } = $props();
	type Item = (typeof data.itens)[number];
	let erro = $state('');
	let aviso = $state('');

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
			await navigator.clipboard.writeText(montarPromptSuporteIA(carregarOpcoesPromptSuporte()));
			promptCopiado = true;
			setTimeout(() => (promptCopiado = false), 2500);
		} catch {
			erro = 'Não consegui copiar. Abra "Importar" e copie a instrução de lá.';
		}
	}

	// ---------- excluir um ----------
	let alvo = $state<Item | null>(null);
	let ciente = $state(false);
	let modal: ConfirmarModal;
	function pedirExclusao(s: Item) {
		alvo = s;
		ciente = false;
		modal.abrir();
	}
	async function excluir(): Promise<string | void> {
		if (!alvo) return;
		const r = await fetch(`/api/admin/suportes/${alvo.id}${(alvo.atividades ?? 0) > 0 ? '?desvincular=1' : ''}`, { method: 'DELETE' });
		if (r.ok) return void (await invalidateAll());
		return ((await r.json().catch(() => ({}))) as { erros?: string[] }).erros?.[0] ?? 'Não foi possível excluir o texto de apoio.';
	}

	// ---------- seleção e ações em lote ----------
	let marcadas = $state<Set<number>>(new Set());
	let todasDoFiltro = $state(false);
	const nMarcadas = $derived(todasDoFiltro ? data.total : marcadas.size);
	const todasNaPagina = $derived(data.itens.length > 0 && data.itens.every((s) => marcadas.has(s.id)));
	function marcar(id: number, on: boolean) {
		todasDoFiltro = false;
		const s = new Set(marcadas);
		on ? s.add(id) : s.delete(id);
		marcadas = s;
	}
	function marcarPagina(on: boolean) {
		todasDoFiltro = false;
		const s = new Set(marcadas);
		for (const i of data.itens) on ? s.add(i.id) : s.delete(i.id);
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
		const r = await fetch('/api/admin/suportes/lote', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(corpo) });
		const j = (await r.json().catch(() => ({}))) as { afetadas?: number; erros?: string[] };
		emLote = false;
		if (!r.ok) {
			erro = j.erros?.[0] ?? 'Não foi possível concluir a ação em lote.';
			return erro;
		}
		const n = nMarcadas;
		aviso = acao === 'excluir' ? `${j.afetadas} texto(s) excluído(s)${(j.afetadas ?? 0) < n ? `; ${n - (j.afetadas ?? 0)} ficaram porque estão em atividades` : ''}.` : `${j.afetadas} texto(s) alterado(s)${(j.afetadas ?? 0) < n ? `; ${n - (j.afetadas ?? 0)} já estavam assim ou não puderam mudar` : ''}.`;
		painel = '';
		valorAcao = '';
		desmarcar();
		await invalidateAll();
	}

	const paginas = $derived(Math.max(Math.ceil(data.total / data.limite), 1));
	const link = (pagina: number) => {
		const p = new URLSearchParams(data.consulta);
		if (pagina > 1) p.set('pagina', String(pagina));
		const s = p.toString();
		return s ? `?${s}` : '?';
	};
	const disciplinaDe = (s: Item) => (s.etiquetas[0] && ehDisciplina(s.etiquetas[0]) ? s.etiquetas[0] : null);
</script>

<svelte:head><title>Textos de apoio · QuestPlus</title></svelte:head>

<div class="topo">
	<h1>Textos de apoio <span class="suave">({data.total})</span></h1>
	<div class="topo-acoes">
		<button type="button" class="sec" onclick={copiarPrompt} title="Copia a instrução para a IA gerar o JSON de textos de apoio, com as últimas opções usadas em Importar">{promptCopiado ? 'Instrução copiada ✔' : 'Copiar instrução para IA'}</button>
		<a class="botao sec-link" href="/admin/suportes/importar">Importar</a>
		<a class="botao sec-link" href="/api/admin/suportes/exportar{data.consulta ? `?${data.consulta}` : ''}" download>Exportar JSON{data.consulta ? ' (filtro atual)' : ' (todos)'}</a>
		<a class="botao" href="/admin/suportes/nova">Novo texto de apoio</a>
	</div>
</div>
<p class="suave">O texto de apoio é escolhido na atividade e aparece antes da questão 1. Pode ter imagens e diagramas (Mermaid).</p>

<FiltrosQuestoes bind:filtro facetas={data.facetas} modo="suportes" onmudou={aoMudar} />

{#if erro}<p class="erro" role="alert">{erro}</p>{/if}
{#if aviso}<p class="aviso" role="status">{aviso}</p>{/if}

<ConfirmarModal bind:this={modal} titulo="Excluir este texto de apoio?" rotuloConfirmar="Excluir texto de apoio" perigo bloqueado={!!alvo && (alvo.atividades ?? 0) > 0 && !ciente} onconfirmar={excluir}>
	{#if alvo}
		<p class="resumo"><strong>{alvo.titulo}</strong>{#if alvo.imagens.length} · {alvo.imagens.length} imagem(ns){/if}</p>
		<p>Esta ação <strong>não pode ser desfeita</strong>. O texto e as imagens dele serão apagados.</p>
		{#if (alvo.atividades ?? 0) > 0}
			<p class="aviso-uso">Este texto está em <strong>{alvo.atividades} atividade(s)</strong>. Elas ficarão sem texto de apoio (provas já feitas guardam a própria cópia).</p>
			<label class="ciente"><input type="checkbox" bind:checked={ciente} /> Entendo que as atividades ficarão sem este texto de apoio.</label>
		{/if}
	{/if}
</ConfirmarModal>

<ConfirmarModal bind:this={modalLote} titulo="Excluir os textos escolhidos?" rotuloConfirmar="Excluir {nMarcadas} texto(s)" perigo onconfirmar={() => lote('excluir')}>
	<p>Serão excluídos até <strong>{nMarcadas} texto(s)</strong>. Esta ação <strong>não pode ser desfeita</strong>. Os que estão em alguma atividade <strong>não são excluídos</strong>; para esses, use a exclusão individual, que avisa as atividades.</p>
</ConfirmarModal>

{#if data.itens.length === 0}
	<p class="suave">Nenhum texto de apoio encontrado.</p>
{:else}
	<div class="barra cartao" class:ativa={nMarcadas > 0}>
		<label class="todas"><input type="checkbox" checked={todasNaPagina} onchange={(e) => marcarPagina(e.currentTarget.checked)} /> Marcar esta página</label>
		{#if nMarcadas === 0}
			<span class="suave">Marque textos para definir a disciplina, etiquetar ou excluir vários de uma vez.</span>
		{:else}
			<strong>{nMarcadas} marcado(s)</strong>
			{#if !todasDoFiltro && data.total > data.itens.length}<button type="button" class="link" onclick={() => (todasDoFiltro = true)}>Marcar os {data.total} do filtro</button>{/if}
			{#if todasDoFiltro}<span class="suave">todos os {data.total} do filtro</span>{/if}
			<button type="button" class="link" onclick={desmarcar}>Desmarcar</button>
			<div class="acoes-lote">
				<button type="button" class="sec" onclick={() => ((painel = 'definir-disciplina'), (valorAcao = ''))}>Definir disciplina…</button>
				<button type="button" class="sec" onclick={() => ((painel = 'add-etiqueta'), (valorAcao = ''))}>Adicionar etiqueta…</button>
				<button type="button" class="sec" onclick={() => ((painel = 'remover-etiqueta'), (valorAcao = ''))}>Remover etiqueta…</button>
				<button type="button" class="sec excluir" disabled={emLote} onclick={() => modalLote.abrir()}>Excluir…</button>
			</div>
			{#if painel}
				<form class="painel" onsubmit={(e) => { e.preventDefault(); if (painel && valorAcao.trim()) lote(painel, valorAcao.trim().toLowerCase()); }}>
					{#if painel === 'definir-disciplina'}
						<label>Disciplina (vira a primeira etiqueta)
							<select bind:value={valorAcao} required>
								<option value="" disabled>Escolha…</option>
								{#each DISCIPLINAS as d}<option value={d.id}>{d.nome}</option>{/each}
							</select>
						</label>
					{:else}
						<label>{painel === 'add-etiqueta' ? 'Etiqueta a adicionar' : 'Etiqueta a remover'}
							<input bind:value={valorAcao} list="etq-suportes" required maxlength="40" placeholder="ex.: pre-analitica" />
							<datalist id="etq-suportes">{#each data.facetas.etiquetas as e}<option value={e.valor}></option>{/each}</datalist>
						</label>
					{/if}
					<button type="submit" disabled={emLote || !valorAcao}>Aplicar a {nMarcadas}</button>
					<button type="button" class="sec" onclick={() => (painel = '')}>Cancelar</button>
				</form>
			{/if}
		{/if}
	</div>

	<div class="lista">
		{#each data.itens as s (s.id)}
			<article class="item">
				<div class="inicio"><input type="checkbox" checked={marcadas.has(s.id) || todasDoFiltro} disabled={todasDoFiltro} onchange={(e) => marcar(s.id, e.currentTarget.checked)} aria-label="Marcar este texto" /></div>
				<div class="corpo">
					<div class="meta">
						{#if disciplinaDe(s)}<span class="disc">{nomeDaDisciplina(disciplinaDe(s)!)}</span>{/if}
						<span class="suave">{s.texto.length} caracteres</span>
						{#if s.imagens.length}<span class="suave">🖼 {s.imagens.length} imagem(ns)</span>{/if}
						{#if /```mermaid/.test(s.texto)}<span class="suave">📈 diagrama</span>{/if}
						<span class="suave">{s.atividades ?? 0} atividade(s)</span>
					</div>
					<p class="titulo"><a href="/admin/suportes/{s.id}">{s.titulo}</a></p>
					<p class="previa suave">{s.texto.replace(/```mermaid[\s\S]*?```/g, '[diagrama]').slice(0, 200)}{s.texto.length > 200 ? '…' : ''}</p>
					{#if s.etiquetas.filter((e) => e !== disciplinaDe(s)).length}<div>{#each s.etiquetas.filter((e) => e !== disciplinaDe(s)) as e}<span class="etiqueta">{e}</span>{/each}</div>{/if}
				</div>
				{#if s.imagens[0]}<img src="/midia/{s.imagens[0].chave}" alt="" width="64" class="mini-img" />{/if}
				<div class="acoes">
					<a class="sec acao-link" href="/admin/suportes/{s.id}">Editar</a>
					<button class="sec excluir" onclick={() => pedirExclusao(s)}>Excluir</button>
				</div>
			</article>
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
	.botao { padding: 0.55rem 1rem; font-weight: 600; color: var(--sobre-primaria); text-decoration: none; background: var(--primaria); border-radius: 0.4rem; }
	.aviso { padding: 0.5rem 0.75rem; border: 1px solid var(--sucesso, var(--primaria)); border-radius: 0.4rem; }
	.barra { display: flex; flex-wrap: wrap; gap: 0.5rem 1rem; align-items: center; margin: 0.5rem 0; padding: 0.6rem 0.9rem; }
	.barra.ativa { border-color: var(--primaria); }
	.todas { display: flex; gap: 0.4rem; align-items: center; margin: 0; font-weight: 400; }
	.acoes-lote { display: flex; flex-wrap: wrap; gap: 0.4rem; flex-basis: 100%; }
	.acoes-lote button { margin: 0; padding: 0.3rem 0.7rem; font-size: 0.85rem; }
	.painel { display: flex; flex-wrap: wrap; gap: 0.5rem; align-items: end; flex-basis: 100%; }
	.painel label { margin: 0; min-width: 14rem; }
	.painel button { margin: 0; }
	.link { display: inline; margin: 0; padding: 0; font-weight: 400; color: var(--primaria); text-decoration: underline; background: none; border: 0; }
	.item { display: flex; gap: 0.75rem; align-items: flex-start; padding: 0.75rem 0.25rem; border-bottom: 1px solid var(--borda); }
	.corpo { flex: 1; min-width: 0; }
	.meta { display: flex; flex-wrap: wrap; gap: 0.35rem 0.6rem; align-items: center; font-size: 0.85rem; }
	.disc { padding: 0 0.5rem; font-size: 0.78rem; font-weight: 600; color: var(--sobre-primaria); background: var(--primaria); border-radius: 1rem; }
	.titulo { margin: 0.3rem 0 0; font-weight: 600; overflow-wrap: anywhere; }
	.previa { margin: 0.2rem 0; overflow-wrap: anywhere; font-size: 0.9rem; }
	.mini-img { height: auto; border-radius: 0.25rem; }
	.acoes { display: flex; flex-wrap: wrap; gap: 0.3rem; justify-content: flex-end; }
	.acoes :global(button), .acoes :global(a) { margin: 0; padding: 0.3rem 0.6rem; font-size: 0.85rem; }
	.acao-link { display: inline-block; font-weight: 600; color: var(--texto); text-decoration: none; border: 1px solid var(--borda); border-radius: 0.4rem; }
	.excluir { color: var(--erro); border-color: var(--erro); }
	.resumo { padding: 0.5rem 0.75rem; overflow-wrap: anywhere; background: var(--fundo); border-radius: 0.4rem; }
	.aviso-uso { padding: 0.5rem 0.75rem; border: 1px solid var(--erro); border-radius: 0.4rem; }
	.ciente { display: flex; gap: 0.5rem; align-items: flex-start; font-weight: 400; }
	.paginas { display: flex; gap: 1rem; align-items: center; justify-content: center; }
	@media (max-width: 40rem) { .item { flex-wrap: wrap; } }
</style>
