<script lang="ts">
	import Tentativa from '#lib/components/Tentativa.svelte';
	import { formatarData } from '#lib/data';
	import LogoCabecalho from '#lib/components/LogoCabecalho.svelte';
	let { data } = $props();
</script>

<svelte:head><title>{data.encontrada ? data.titulo : 'Atividade'} · QuestPlus</title></svelte:head>

<div class="topo"><a href="/">QuestPlus</a></div>

<main>
	{#if !data.encontrada}
		<h1>Código não encontrado</h1>
		<p>Confira o código com o professor e tente de novo.</p>
		<p><a href="/">Digitar outro código</a></p>
	{:else if data.estado === 'antes'}
		{#if data.logo}<LogoCabecalho chave={data.logo} />{/if}
		<h1>{data.titulo}</h1>
		{#if data.componente}<p class="componente">{data.componente}</p>{/if}
		<p>Esta atividade ainda não abriu. Ela abre em <strong>{formatarData(data.abre_em)}</strong>.</p>
	{:else if data.estado === 'encerrada'}
		{#if data.logo}<LogoCabecalho chave={data.logo} />{/if}
		<h1>{data.titulo}</h1>
		{#if data.componente}<p class="componente">{data.componente}</p>{/if}
		<p>O prazo desta atividade acabou em <strong>{formatarData(data.fecha_em)}</strong>.</p>
	{:else}
		<Tentativa codigo={data.codigo} titulo={data.titulo} componente={data.componente} logo={data.logo} turmas={data.turmas} fecha_em={data.fecha_em} regras={data.regras} />
	{/if}
</main>

<style>
	.topo { display: flex; align-items: center; justify-content: space-between; max-width: 40rem; margin: 0 auto; padding: 0.6rem 1rem 0; font-weight: 700; }
	.topo a { text-decoration: none; }
	main { max-width: 40rem; }
</style>
