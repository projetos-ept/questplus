<script lang="ts">
	import AtividadeForm from '#lib/components/AtividadeForm.svelte';
	let { data } = $props();
</script>

<svelte:head><title>Nova atividade · QuestPlus</title></svelte:head>
<h1>Nova atividade</h1>
<AtividadeForm
	inicial={{ titulo: '', codigo: '', ativa: true, embaralhar: false, abre_em: null, fecha_em: null, questoes: [], turmas: [] }}
	turmasDisponiveis={data.turmas}
/>
