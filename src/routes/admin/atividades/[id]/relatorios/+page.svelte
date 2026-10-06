<script lang="ts">
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';
	import RelatorioAluno, { type DadosRelatorio } from '#lib/components/RelatorioAluno.svelte';

	let { data } = $props();
	let gabarito = $state(true);
	let apoio = $state(true);
	let relatorios = $state<DadosRelatorio[]>([]);
	let carregando = $state(true);
	let falhas = $state(0);

	// um aluno por vez: o servidor não monta um documento enorme, e o navegador mostra o andamento
	onMount(async () => {
		for (const id of data.ids) {
			try {
				const r = await fetch(`/api/admin/tentativas/${id}/relatorio`);
				if (r.ok) relatorios.push((await r.json()) as DadosRelatorio);
				else falhas++;
			} catch {
				falhas++;
			}
		}
		carregando = false;
	});

	function filtrarTurma(e: Event) {
		const v = (e.currentTarget as HTMLSelectElement).value;
		goto(v ? `?turma=${v}` : '?', { reset: false });
		setTimeout(() => location.reload(), 50);
	}
</script>

<svelte:head><title>Relatórios individuais · {data.atividade.titulo}</title></svelte:head>

<div class="nao-imprimir barra">
	<a href="/admin/atividades/{data.atividade.id}/relatorio">← Relatório da atividade</a>
	<label class="check">Turma
		<select aria-label="Filtrar por turma" onchange={filtrarTurma} value={data.turmaId ?? ''}>
			<option value="">Todas</option>
			{#each data.turmas as t}<option value={t.id}>{t.nome}</option>{/each}
		</select>
	</label>
	<label class="check"><input type="checkbox" bind:checked={gabarito} /> Gabarito e explicações</label>
	<label class="check"><input type="checkbox" bind:checked={apoio} /> Textos de apoio</label>
	<button type="button" onclick={() => window.print()} disabled={carregando || !relatorios.length}>Imprimir / salvar em PDF</button>
</div>

<p class="nao-imprimir suave" aria-live="polite">
	{#if carregando}Carregando relatórios… {relatorios.length} de {data.ids.length}
	{:else if !data.ids.length}Nenhum aluno finalizou esta atividade ainda.
	{:else}{relatorios.length} relatório(s) pronto(s), um por aluno (a tentativa de maior nota), cada um em uma folha.{falhas ? ` ${falhas} não puderam ser carregados.` : ''}{/if}
</p>

{#each relatorios as dados, i (dados.id)}
	<div class:nova-pagina={i > 0}><RelatorioAluno {dados} {gabarito} {apoio} /></div>
{/each}

<style>
	.barra { display: flex; flex-wrap: wrap; gap: 0.5rem 1.25rem; align-items: center; margin-bottom: 1rem; padding: 0.6rem 0.8rem; background: var(--superficie); border: 1px solid var(--borda); border-radius: 0.5rem; }
	.barra button { margin: 0; padding: 0.45rem 0.9rem; }
	.barra select { display: inline-block; width: auto; margin: 0 0 0 0.4rem; }
	.check { display: flex; gap: 0.4rem; align-items: center; margin: 0; font-weight: 400; }
</style>
