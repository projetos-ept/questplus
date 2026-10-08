<script lang="ts">
	/** Logo no canto superior esquerdo do cabeçalho (relatórios) e acima do título na abertura da atividade. */
	let { chave, nome = 'Logo' }: { chave: string; nome?: string } = $props();
</script>

<div class="logo-quadrado"><img src="/midia/{chave}" alt={nome} /></div>
