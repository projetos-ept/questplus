<script lang="ts">
	import type { Snippet } from 'svelte';

	let {
		titulo,
		rotuloConfirmar = 'Confirmar',
		perigo = false,
		bloqueado = false,
		onconfirmar,
		children
	}: {
		titulo: string;
		rotuloConfirmar?: string;
		perigo?: boolean;
		/** Mantém o botão de confirmar desabilitado (ex.: até marcar uma caixa de ciência). */
		bloqueado?: boolean;
		/** Devolve uma mensagem de erro para mostrar no modal, ou nada para fechar. */
		onconfirmar: () => Promise<string | void>;
		children?: Snippet;
	} = $props();

	let dialogo: HTMLDialogElement;
	let erro = $state('');
	let ocupado = $state(false);
	const rotulo = `modal-${Math.random().toString(36).slice(2, 8)}`;

	export function abrir() {
		erro = '';
		dialogo?.showModal();
	}
	export function fechar() {
		// pode ser chamado depois de a página navegar (ex.: excluir e voltar para a lista), quando o elemento já não existe
		dialogo?.close();
	}

	async function confirmar() {
		ocupado = true;
		erro = '';
		try {
			erro = (await onconfirmar()) ?? '';
		} catch {
			erro = 'Falha de conexão. Tente de novo.';
		}
		ocupado = false;
		if (!erro) fechar();
	}
</script>

<!-- clicar fora do cartão (no fundo) fecha; Esc também, nativamente -->
<dialog bind:this={dialogo} aria-labelledby={rotulo} onclick={(e) => e.target === dialogo && fechar()}>
	<div class="corpo">
		<h2 id={rotulo}>{titulo}</h2>
		{@render children?.()}
		{#if erro}<p class="erro" role="alert">{erro}</p>{/if}
		<div class="acoes">
			<button type="button" class="sec" onclick={fechar} disabled={ocupado}>Cancelar</button>
			<button type="button" class:perigo onclick={confirmar} disabled={ocupado || bloqueado}>{ocupado ? 'Aguarde…' : rotuloConfirmar}</button>
		</div>
	</div>
</dialog>

<style>
	dialog {
		width: min(28rem, calc(100vw - 2rem));
		padding: 0;
		color: var(--texto);
		background: var(--superficie);
		border: 1px solid var(--borda);
		border-radius: 0.7rem;
	}
	dialog::backdrop {
		background: rgb(0 0 0 / 0.5);
	}
	.corpo {
		padding: 1.25rem;
	}
	h2 {
		margin: 0 0 0.75rem;
		font-size: 1.15rem;
	}
	.acoes {
		display: flex;
		flex-wrap: wrap;
		gap: 0.75rem;
		justify-content: flex-end;
		margin-top: 1.25rem;
	}
	.acoes button {
		margin: 0;
	}
	.perigo {
		color: #fff;
		background: var(--erro);
	}
</style>
