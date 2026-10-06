<script lang="ts" module>
	export type Facetas = {
		disciplinas: { valor: string; n: number }[];
		tipos: Record<string, number>;
		etiquetas: { valor: string; n: number }[];
		apoio: { com: number; sem: number };
	};
</script>

<script lang="ts">
	import { nomeDaDisciplina } from '#lib/disciplinas';
	import { ORDENS, filtroVazio, filtrosAtivos, type FiltroQuestoes } from '#lib/filtros';

	let {
		filtro = $bindable(),
		facetas,
		mostrarSituacao = false,
		onmudou
	}: { filtro: FiltroQuestoes; facetas: Facetas | null; mostrarSituacao?: boolean; onmudou: (digitando?: boolean) => void } = $props();

	const ativos = $derived(filtrosAtivos(filtro, mostrarSituacao));
	const n = (k: string) => (facetas ? ` (${facetas.tipos[k] ?? 0})` : '');
	let nova = $state('');

	function adicionarEtiqueta() {
		if (nova && !filtro.etiquetas.includes(nova)) filtro.etiquetas = [...filtro.etiquetas, nova];
		nova = '';
		onmudou();
	}
	function tirarEtiqueta(e: string) {
		filtro.etiquetas = filtro.etiquetas.filter((x) => x !== e);
		onmudou();
	}
	function limpar() {
		const ordem = filtro.ordem;
		filtro = { ...filtroVazio(), ordem, ativa: mostrarSituacao ? '' : filtro.ativa };
		onmudou();
	}
	/** Resumo dos filtros ligados, cada um com o × para desligar só ele. */
	const chips = $derived(
		[
			filtro.q.trim() && { rotulo: `Busca: "${filtro.q.trim()}"`, tirar: () => (filtro.q = '') },
			filtro.disciplina && { rotulo: `Disciplina: ${nomeDaDisciplina(filtro.disciplina)}`, tirar: () => (filtro.disciplina = '') },
			filtro.tipo && { rotulo: `Formato: ${{ mc: 'Múltipla escolha', vf: 'Verdadeiro ou falso', aberta: 'Aberta' }[filtro.tipo]}`, tirar: () => (filtro.tipo = '') },
			filtro.apoio && { rotulo: filtro.apoio === '1' ? 'Com texto de apoio' : 'Sem texto de apoio', tirar: () => (filtro.apoio = '') },
			mostrarSituacao && filtro.ativa && { rotulo: filtro.ativa === '1' ? 'Só ativas' : 'Só inativas', tirar: () => (filtro.ativa = '') }
		].filter(Boolean) as { rotulo: string; tirar: () => void }[]
	);
</script>

<div class="filtros cartao" role="search" aria-label="Filtrar questões">
	<div class="linha1">
		<label class="busca">Busca <input type="search" bind:value={filtro.q} oninput={() => onmudou(true)} placeholder="Trecho do enunciado" /></label>
		<label>Ordenar
			<select bind:value={filtro.ordem} onchange={() => onmudou()}>
				{#each ORDENS as [v, r]}<option value={v}>{r}</option>{/each}
			</select>
		</label>
	</div>
	<div class="grade">
		<label>Disciplina
			<select bind:value={filtro.disciplina} onchange={() => onmudou()}>
				<option value="">Todas{facetas ? ` (${facetas.disciplinas.reduce((s, d) => s + d.n, 0)})` : ''}</option>
				{#each facetas?.disciplinas ?? [] as d (d.valor)}<option value={d.valor}>{nomeDaDisciplina(d.valor)} ({d.n})</option>{/each}
				{#if filtro.disciplina && !facetas?.disciplinas.some((d) => d.valor === filtro.disciplina)}<option value={filtro.disciplina}>{nomeDaDisciplina(filtro.disciplina)} (0)</option>{/if}
			</select>
		</label>
		<label>Formato
			<select bind:value={filtro.tipo} onchange={() => onmudou()}>
				<option value="">Todos</option>
				<option value="mc">Múltipla escolha{n('mc')}</option>
				<option value="vf">Verdadeiro ou falso{n('vf')}</option>
				<option value="aberta">Aberta{n('aberta')}</option>
			</select>
		</label>
		<label>Texto de apoio
			<select bind:value={filtro.apoio} onchange={() => onmudou()}>
				<option value="">Tanto faz</option>
				<option value="1">Com apoio{facetas ? ` (${facetas.apoio.com})` : ''}</option>
				<option value="0">Sem apoio{facetas ? ` (${facetas.apoio.sem})` : ''}</option>
			</select>
		</label>
		{#if mostrarSituacao}
			<label>Situação
				<select bind:value={filtro.ativa} onchange={() => onmudou()}>
					<option value="">Todas</option>
					<option value="1">Ativas</option>
					<option value="0">Inativas</option>
				</select>
			</label>
		{/if}
		<label>Etiqueta (some às outras)
			<select bind:value={nova} onchange={adicionarEtiqueta}>
				<option value="">Adicionar etiqueta…</option>
				{#each facetas?.etiquetas ?? [] as e (e.valor)}<option value={e.valor}>{e.valor} ({e.n})</option>{/each}
			</select>
		</label>
	</div>
	{#if filtro.etiquetas.length || chips.length}
		<div class="ativos" aria-label="Filtros ligados">
			{#each chips as c}<button type="button" class="chip" onclick={() => { c.tirar(); onmudou(); }} aria-label="Tirar filtro {c.rotulo}">{c.rotulo} ✕</button>{/each}
			{#each filtro.etiquetas as e}<button type="button" class="chip etq" onclick={() => tirarEtiqueta(e)} aria-label="Tirar etiqueta {e}">#{e} ✕</button>{/each}
			{#if filtro.etiquetas.length > 1}<span class="suave">a questão precisa ter <strong>todas</strong> as etiquetas</span>{/if}
		</div>
	{/if}
	{#if ativos > 0}<button type="button" class="link" onclick={limpar}>Limpar {ativos === 1 ? 'o filtro' : `os ${ativos} filtros`}</button>{/if}
</div>

<style>
	.filtros { margin: 1rem 0; }
	.linha1 { display: grid; grid-template-columns: 1fr minmax(10rem, 14rem); gap: 0 0.75rem; }
	.grade { display: grid; grid-template-columns: repeat(auto-fit, minmax(11rem, 1fr)); gap: 0 0.75rem; }
	@media (max-width: 40rem) { .linha1 { grid-template-columns: 1fr; } }
	.ativos { display: flex; flex-wrap: wrap; gap: 0.4rem; align-items: center; margin-top: 0.75rem; }
	.chip { margin: 0; padding: 0.2rem 0.6rem; font-size: 0.8rem; font-weight: 600; color: var(--texto); background: var(--fundo); border: 1px solid var(--borda); border-radius: 1rem; }
	.chip.etq { border-color: var(--destaque); }
	.link { display: inline; margin: 0.6rem 0 0; padding: 0; color: var(--destaque); font-weight: 400; text-decoration: underline; background: none; border: 0; }
</style>
