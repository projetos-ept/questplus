<script lang="ts">
	import { onMount } from 'svelte';
	import qrcode from 'qrcode-generator';

	// QR code do link curto da atividade (https://…/CODIGO): o aluno aponta a câmera do celular para a tela do professor.
	// Miniatura clicável na tabela; o clique abre o QR ampliado (clicar fora, X ou Esc fecham).
	let { codigo, titulo }: { codigo: string; titulo: string } = $props();

	let link = $state('');
	let svgPequeno = $state('');
	let svgGrande = $state('');
	let dialogo: HTMLDialogElement;

	onMount(() => {
		link = `${location.origin}/${codigo}`;
		const qr = qrcode(0, 'M'); // tamanho automático, correção de erro média
		qr.addData(link);
		qr.make();
		// margem de 4 módulos (a "zona silenciosa" que os leitores exigem); fundo branco e cor preta, em qualquer tema
		svgPequeno = qr.createSvgTag({ cellSize: 2, margin: 4, scalable: true });
		svgGrande = svgPequeno;
	});

	const abrir = () => dialogo.showModal();
	const fechar = () => dialogo.close();
</script>

{#if svgPequeno}
	<button type="button" class="miniatura sec" onclick={abrir} aria-haspopup="dialog" aria-label="Ampliar o QR code da atividade {titulo}" title="Ampliar o QR code">
		<span class="qr" aria-hidden="true">{@html svgPequeno}</span>
	</button>
{/if}

<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_noninteractive_element_interactions -->
<dialog bind:this={dialogo} class="nao-imprimir" aria-labelledby="t-qr-{codigo}" onclick={(e) => e.target === dialogo && fechar()}>
	<div class="corpo">
		<h2 id="t-qr-{codigo}">{titulo}</h2>
		<p class="suave">Aponte a câmera do celular para o QR code para abrir a atividade.</p>
		<div class="qr grande" role="img" aria-label="QR code que abre {link}">{@html svgGrande}</div>
		<p class="link"><code>{link}</code></p>
		<button type="button" class="sec" onclick={fechar}>Fechar</button>
	</div>
</dialog>

<style>
	.miniatura { display: inline-grid; place-items: center; width: 52px; height: 52px; min-height: 0; margin: 0; padding: 2px; background: #fff; border: 1px solid var(--borda); border-radius: 8px; box-shadow: none; }
	.qr { display: block; line-height: 0; background: #fff; }
	.qr :global(svg) { display: block; width: 100%; height: auto; }
	.miniatura .qr { width: 44px; height: 44px; }
	dialog { width: min(28rem, calc(100vw - 2rem)); padding: 0; color: var(--texto); background: var(--superficie); border: 1px solid var(--borda); border-radius: var(--raio); box-shadow: var(--sombra); }
	dialog::backdrop { background: color-mix(in srgb, var(--texto) 55%, transparent); }
	.corpo { padding: 1.25rem; text-align: center; }
	h2 { margin: 0 0 0.25rem; font-size: var(--escala-h3); overflow-wrap: anywhere; }
	.grande { width: min(100%, 22rem); margin: 0.75rem auto; border: 1px solid var(--borda); border-radius: 12px; overflow: hidden; }
	.link { margin: 0 0 0.75rem; overflow-wrap: anywhere; }
	.corpo button { margin: 0; }
</style>
