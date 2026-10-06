<script lang="ts">
	import QuestaoForm from '#lib/components/QuestaoForm.svelte';
	import { formularioVazio } from '#lib/questao';
	let { data } = $props();
</script>

<svelte:head><title>Nova questão · QuestPlus</title></svelte:head>
<h1>Nova questão</h1>
<QuestaoForm inicial={formularioVazio()} suportes={data.suportes} />
