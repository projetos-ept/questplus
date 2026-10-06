<script lang="ts">
	import AtividadeForm from '#lib/components/AtividadeForm.svelte';
	import CopiarLink from '#lib/components/CopiarLink.svelte';
	let { data } = $props();
</script>

<svelte:head><title>Editar atividade · QuestPlus</title></svelte:head>

{#if data.criada}
	<div class="cartao aviso" role="status">
		<strong>Atividade criada.</strong> Passe este link aos alunos (ou o código <code>{data.atividade.codigo}</code> na página inicial):
		<div class="copia"><CopiarLink codigo={data.atividade.codigo} /></div>
	</div>
{/if}

{#if data.clonada}
	<div class="cartao aviso" role="status">
		<strong>Cópia criada.</strong> Ela começa <strong>inativa</strong> e sem datas, com um código novo (<code>{data.atividade.codigo}</code>). Ajuste o título e o prazo e marque <em>Atividade ativa</em> quando quiser abrir.
	</div>
{/if}

<h1>{data.atividade.titulo}</h1>
<p><a href="/admin/atividades/{data.id}/tentativas">Ver tentativas</a>{#if data.questoes.some((q) => q.tipo === 'aberta')} · <a href="/admin/atividades/{data.id}/abertas">Correção das questões abertas</a>{/if}</p>

<AtividadeForm
	id={data.id}
	inicial={{ ...data.atividade, questoes: data.questoes, turmas: data.turmasSel }}
	turmasDisponiveis={data.turmas}
/>

<style>
	.aviso { margin-bottom: 1rem; border-color: var(--ok); }
	.copia { margin-top: 0.6rem; }
</style>
