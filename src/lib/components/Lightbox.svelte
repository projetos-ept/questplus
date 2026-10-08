<script lang="ts">
	import { onMount } from 'svelte';

	// Visualizador de imagens: clicar (ou Enter/Espaço) em qualquer imagem de questão ou de texto de apoio (`.suporte-img img`)
	// abre a imagem ampliada. Zoom por roda do mouse, botões, teclas + − 0, duplo clique e pinça; arrastar move a imagem ampliada.
	// Fecha no X, clicando fora da imagem ou com Esc. Um só componente no layout raiz atende todas as telas.
	const MIN = 1;
	const MAX = 6;
	let dialogo: HTMLDialogElement;
	let palco: HTMLDivElement;
	let img: HTMLImageElement;
	let botaoFechar: HTMLButtonElement;
	let src = $state('');
	let alt = $state('');
	let escala = $state(1);
	let tx = $state(0);
	let ty = $state(0);
	let gatilho: HTMLElement | null = null;
	const ponteiros = new Map<number, PointerEvent>();
	let dist0 = 0;
	let escala0 = 1;

	const percentual = $derived(Math.round(escala * 100));

	function abrir(el: HTMLImageElement) {
		gatilho = el;
		src = el.currentSrc || el.src;
		alt = el.alt;
		escala = 1;
		tx = ty = 0;
		dialogo.showModal();
		botaoFechar?.focus();
	}
	function fechar() {
		if (dialogo.open) dialogo.close();
	}
	function aoFechar() {
		gatilho?.focus?.();
		gatilho = null;
	}
	function ajustar() {
		escala = 1;
		tx = ty = 0;
	}
	function zoom(fator: number, cx?: number, cy?: number) {
		const nova = Math.min(MAX, Math.max(MIN, escala * fator));
		if (nova === escala) return;
		const r = img.getBoundingClientRect();
		const ox = (cx ?? innerWidth / 2) - (r.left + r.width / 2);
		const oy = (cy ?? innerHeight / 2) - (r.top + r.height / 2);
		const k = nova / escala;
		tx -= ox * (k - 1);
		ty -= oy * (k - 1);
		escala = nova;
		if (escala <= 1) tx = ty = 0;
	}

	function aoClicarFora(e: MouseEvent) {
		if (e.target === dialogo || e.target === palco) fechar();
	}
	function aoRolar(e: WheelEvent) {
		e.preventDefault();
		zoom(e.deltaY < 0 ? 1.15 : 1 / 1.15, e.clientX, e.clientY);
	}
	function aoDuploClique(e: MouseEvent) {
		if (escala > 1) ajustar();
		else zoom(2.5, e.clientX, e.clientY);
	}
	function aoPressionar(e: PointerEvent) {
		if (e.target !== img) return;
		ponteiros.set(e.pointerId, e);
		img.setPointerCapture(e.pointerId);
		if (ponteiros.size === 2) {
			const [a, b] = [...ponteiros.values()];
			dist0 = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
			escala0 = escala;
		}
	}
	function aoMover(e: PointerEvent) {
		const anterior = ponteiros.get(e.pointerId);
		if (!anterior) return;
		if (ponteiros.size === 2) {
			ponteiros.set(e.pointerId, e);
			const [a, b] = [...ponteiros.values()];
			const d = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
			escala = Math.min(MAX, Math.max(MIN, (escala0 * d) / dist0));
			if (escala <= 1) tx = ty = 0;
			return;
		}
		if (escala > 1) {
			tx += e.clientX - anterior.clientX;
			ty += e.clientY - anterior.clientY;
		}
		ponteiros.set(e.pointerId, e);
	}
	const soltar = (e: PointerEvent) => void ponteiros.delete(e.pointerId);
	function aoTeclar(e: KeyboardEvent) {
		if (e.key === '+' || e.key === '=') zoom(1.4);
		else if (e.key === '-') zoom(1 / 1.4);
		else if (e.key === '0') ajustar();
	}

	onMount(() => {
		const alvo = (e: Event) => (e.target instanceof Element ? (e.target.closest('.suporte-img img') as HTMLImageElement | null) : null);
		const clique = (e: MouseEvent) => {
			const el = alvo(e);
			if (el) {
				e.preventDefault();
				abrir(el);
			}
		};
		const tecla = (e: KeyboardEvent) => {
			if (e.key !== 'Enter' && e.key !== ' ') return;
			const el = alvo(e);
			if (el) {
				e.preventDefault();
				abrir(el);
			}
		};
		// as imagens dos textos de apoio chegam como HTML pronto: torna cada uma focável e anunciada como botão
		const marcar = (raiz: ParentNode) =>
			raiz.querySelectorAll?.('.suporte-img img:not([data-ampliar])').forEach((el) => {
				el.setAttribute('data-ampliar', '');
				el.setAttribute('tabindex', '0');
				el.setAttribute('role', 'button');
				el.setAttribute('aria-haspopup', 'dialog');
				el.setAttribute('aria-label', `Ampliar imagem: ${el.getAttribute('alt') ?? ''}`.trim());
			});
		marcar(document);
		const obs = new MutationObserver(() => marcar(document));
		obs.observe(document.body, { childList: true, subtree: true });
		document.addEventListener('click', clique);
		document.addEventListener('keydown', tecla);
		return () => {
			obs.disconnect();
			document.removeEventListener('click', clique);
			document.removeEventListener('keydown', tecla);
		};
	});
</script>

<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_noninteractive_element_interactions -->
<dialog bind:this={dialogo} class="nao-imprimir" aria-label="Imagem ampliada" onclose={aoFechar} onclick={aoClicarFora} onkeydown={aoTeclar}>
	<div bind:this={palco} class="palco" class:ampliada={escala > 1} onwheel={aoRolar}>
		<img
			bind:this={img}
			{src}
			{alt}
			draggable="false"
			style="transform: translate({tx}px, {ty}px) scale({escala})"
			ondblclick={aoDuploClique}
			onpointerdown={aoPressionar}
			onpointermove={aoMover}
			onpointerup={soltar}
			onpointercancel={soltar}
		/>
	</div>
	<div class="zoom-barra" role="group" aria-label="Zoom">
		<button type="button" class="sec z" aria-label="Diminuir zoom" onclick={() => zoom(1 / 1.4)} disabled={escala <= MIN}>−</button>
		<output aria-live="polite">{percentual}%</output>
		<button type="button" class="sec z" aria-label="Aumentar zoom" onclick={() => zoom(1.4)} disabled={escala >= MAX}>+</button>
		<button type="button" class="sec z txt" onclick={ajustar} disabled={escala === 1}>Ajustar</button>
	</div>
	<button bind:this={botaoFechar} type="button" class="sec x" aria-label="Fechar imagem" onclick={fechar}>✕</button>
</dialog>

<style>
	dialog {
		width: 100vw;
		max-width: 100vw;
		height: 100dvh;
		max-height: 100dvh;
		padding: 0;
		color: var(--texto);
		background: transparent;
		border: 0;
	}
	dialog::backdrop {
		background: color-mix(in srgb, var(--texto) 70%, transparent);
	}
	.palco {
		position: absolute;
		inset: 0;
		display: grid;
		place-items: center;
		overflow: hidden;
		touch-action: none;
	}
	img {
		max-width: min(92vw, 1200px);
		max-height: 80dvh;
		background: var(--superficie);
		border: var(--borda-espessura) var(--borda-estilo) var(--borda-cor);
		border-radius: 14px;
		box-shadow: var(--sombra-hover);
		cursor: zoom-in;
		user-select: none;
	}
	.palco.ampliada img {
		cursor: grab;
	}
	.palco.ampliada img:active {
		cursor: grabbing;
	}
	.zoom-barra {
		position: fixed;
		bottom: 18px;
		left: 50%;
		display: flex;
		gap: 0.4rem;
		align-items: center;
		padding: 0.4rem 0.6rem;
		background: var(--superficie);
		border: var(--borda-espessura) var(--borda-estilo) var(--borda-cor);
		border-radius: 14px;
		box-shadow: none;
		transform: translateX(-50%);
	}
	output {
		min-width: 3.4rem;
		text-align: center;
		font-weight: var(--peso-acao);
	}
	.z {
		min-width: var(--altura-controle);
		margin: 0;
		padding: 0 0.7rem;
	}
	.x {
		position: fixed;
		top: 14px;
		right: 14px;
		min-width: 44px;
		min-height: 44px;
		margin: 0;
		padding: 0;
		color: var(--texto);
		border-color: var(--borda);
		border-radius: 50%;
		box-shadow: none;
	}
	.x:hover:not(:disabled), .z:hover:not(:disabled) {
		box-shadow: none;
	}
</style>
