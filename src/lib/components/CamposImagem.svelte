<script lang="ts">
	import { ROTULO_TAMANHO, type ImagemSuporte } from '#lib/imagens';

	let { imagem = $bindable() }: { imagem: ImagemSuporte } = $props();
</script>

<label>Legenda <span class="suave">(aparece abaixo da imagem)</span>
	<textarea bind:value={imagem.legenda} rows="2" maxlength="300"></textarea>
</label>
<div class="tamanho">
	<label>Tamanho
		<select bind:value={imagem.tamanho}>
			{#each Object.entries(ROTULO_TAMANHO) as [valor, rotulo]}<option value={valor}>{rotulo}</option>{/each}
		</select>
	</label>
	{#if imagem.tamanho === 'personalizada'}
		<label>Largura (px)
			<input type="number" min="50" max="1600" step="10" bind:value={imagem.largura} required placeholder="300" />
		</label>
	{/if}
</div>
{#if imagem.origem}<p class="suave origem">Fonte: <a href={imagem.origem} target="_blank" rel="noopener noreferrer">{imagem.origem}</a></p>{/if}

<style>
	label { margin-top: 0.6rem; font-weight: 600; }
	.tamanho { display: flex; flex-wrap: wrap; gap: 0 1rem; }
	.tamanho label { flex: 1 1 10rem; }
	.origem { margin: 0.5rem 0 0; overflow-wrap: anywhere; font-size: 0.85rem; }
</style>
