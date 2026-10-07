<script lang="ts">
	import QuestaoForm from '#lib/components/QuestaoForm.svelte';
	import { formularioDe } from '#lib/questao';
	let { data } = $props();
</script>

<svelte:head><title>Editar questão · QuestPlus</title></svelte:head>
{#if data.duplicada}
	<div class="cartao aviso" role="status"><strong>Cópia criada.</strong> Edite o que quiser (enunciado, alternativas, gabarito); a questão original continua como estava.</div>
{/if}
<h1>Editar questão #{data.id}</h1>
<p class="suave">Atividades já respondidas guardam uma cópia da questão; editar aqui não altera provas feitas.</p>
<QuestaoForm id={data.id} inicial={formularioDe(data.questao)} />

<style>
	.aviso { margin-bottom: 1rem; border-color: var(--sucesso); }
</style>
