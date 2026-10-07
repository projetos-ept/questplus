<script lang="ts">
	import SuporteForm from '#lib/components/SuporteForm.svelte';
	let { data } = $props();
</script>

<svelte:head><title>Editar texto de apoio · QuestPlus</title></svelte:head>
<h1>Editar texto de apoio</h1>
<SuporteForm id={data.id} inicial={data.suporte} emUso={data.suporte.atividades ?? 0} />
