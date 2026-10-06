<script lang="ts">
	import QuestaoForm from '#lib/components/QuestaoForm.svelte';
	import { formularioDe } from '#lib/questao';
	let { data } = $props();
</script>

<svelte:head><title>Editar questão · QuestPlus</title></svelte:head>
<h1>Editar questão #{data.id}</h1>
<p class="suave">Atividades já respondidas guardam uma cópia da questão; editar aqui não altera provas feitas.</p>
<QuestaoForm id={data.id} inicial={formularioDe(data.questao)} suportes={data.suportes} />
