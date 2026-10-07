<script lang="ts">
	import QuestaoForm from '#lib/components/QuestaoForm.svelte';
	import { formularioVazio } from '#lib/questao';
</script>

<svelte:head><title>Nova questão · QuestPlus</title></svelte:head>
<h1>Nova questão</h1>
<QuestaoForm inicial={formularioVazio()} />
