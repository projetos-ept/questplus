<script lang="ts">
	import { larguraDe, type ImagemSuporte } from '#lib/imagens';

	let { imagem }: { imagem: ImagemSuporte | null | undefined } = $props();
</script>

{#if imagem}
	<!-- sempre centralizada e logo abaixo do enunciado; o estilo .suporte-img é o mesmo das imagens dos textos de apoio -->
	<figure class="suporte-img questao-img">
		<img src="/midia/{imagem.chave}" alt={imagem.legenda || 'Imagem da questão'} loading="lazy" style="width:{larguraDe(imagem)}px" />
		{#if imagem.legenda}<figcaption>{imagem.legenda}</figcaption>{/if}
	</figure>
{/if}
