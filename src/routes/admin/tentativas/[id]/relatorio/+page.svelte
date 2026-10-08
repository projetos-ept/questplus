<script lang="ts">
	import RelatorioAluno from '#lib/components/RelatorioAluno.svelte';
	let { data } = $props();
	let gabarito = $state(true);
	let apoio = $state(true);
</script>

<svelte:head><title>Relatório de {data.dados.aluno.nome} · QuestPlus</title></svelte:head>

<div class="nao-imprimir barra">
	<a href="/admin/relatorios/{data.dados.atividade.id}">← Relatório da atividade</a> · <a href="/admin/atividades/{data.dados.atividade.id}/tentativas">Tentativas</a>
	<label class="check"><input type="checkbox" bind:checked={gabarito} /> Mostrar gabarito e explicações</label>
	<label class="check"><input type="checkbox" bind:checked={apoio} /> Mostrar textos de apoio</label>
	<button type="button" onclick={() => window.print()}>Imprimir / salvar em PDF</button>
</div>

<RelatorioAluno dados={data.dados} {gabarito} {apoio} />

<style>
	.barra { display: flex; flex-wrap: wrap; gap: 0.5rem 1.25rem; align-items: center; margin-bottom: 1rem; padding: 0.6rem 0.8rem; background: var(--superficie); border: 1px solid var(--borda); border-radius: 0.5rem; }
	.barra button { margin: 0; padding: 0.45rem 0.9rem; }
	.check { display: flex; gap: 0.4rem; align-items: center; margin: 0; font-weight: 400; }
</style>
