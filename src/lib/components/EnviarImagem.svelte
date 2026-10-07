<script lang="ts">
	import { reduzir } from '#lib/imagem';

	let { onenviada, multiplas = false }: { onenviada: (chave: string, origem: string | null) => void; multiplas?: boolean } = $props();

	let enviando = $state(false);
	let link = $state('');
	let erro = $state('');

	/** Envia o(s) arquivo(s) para o R2 (reduzidos no navegador) e avisa a chave de cada um. */
	async function enviarArquivos(e: Event) {
		const input = e.currentTarget as HTMLInputElement;
		const arquivos = [...(input.files ?? [])];
		erro = '';
		enviando = true;
		try {
			for (const arquivo of arquivos) {
				const dados = new FormData();
				dados.set('arquivo', await reduzir(arquivo));
				const r = await fetch('/api/admin/midia', { method: 'POST', body: dados });
				const corpo = (await r.json().catch(() => ({}))) as { chave?: string; erros?: string[] };
				if (!r.ok || !corpo.chave) {
					erro = `${arquivo.name}: ${corpo.erros?.[0] ?? 'não foi possível enviar.'}`;
					break;
				}
				onenviada(corpo.chave, null);
			}
		} catch {
			erro = 'Falha de conexão ao enviar a imagem.';
		} finally {
			enviando = false;
			input.value = '';
		}
	}

	async function baixarLink() {
		if (!link.trim()) return;
		erro = '';
		enviando = true;
		try {
			const r = await fetch('/api/admin/midia/importar-url', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ url: link.trim() }) });
			const corpo = (await r.json().catch(() => ({}))) as { chave?: string; origem?: string; erros?: string[] };
			if (!r.ok || !corpo.chave) erro = corpo.erros?.[0] ?? 'Não foi possível baixar a imagem desse link.';
			else {
				onenviada(corpo.chave, corpo.origem ?? link.trim());
				link = '';
			}
		} catch {
			erro = 'Falha de conexão ao baixar a imagem.';
		} finally {
			enviando = false;
		}
	}
</script>

<div class="adicionar">
	<label class="arquivo">Enviar arquivo <span class="suave">(PNG, JPG, WEBP ou GIF até 2 MB; reduzida no navegador)</span>
		<input type="file" multiple={multiplas} accept="image/png,image/jpeg,image/webp,image/gif" onchange={enviarArquivos} disabled={enviando} />
	</label>
	<div class="link">
		<label for="link-img-q">…ou cole o endereço da imagem <span class="suave">(o sistema baixa e guarda uma cópia)</span></label>
		<div class="linha">
			<input id="link-img-q" type="url" bind:value={link} placeholder="https://…/imagem.png" disabled={enviando} onkeydown={(e) => { if (e.key === 'Enter') { e.preventDefault(); baixarLink(); } }} />
			<button type="button" class="sec" onclick={baixarLink} disabled={enviando || !link.trim()}>Baixar e anexar</button>
		</div>
	</div>
	{#if enviando}<p class="suave" role="status">Enviando…</p>{/if}
	{#if erro}<p class="erro" role="alert">{erro}</p>{/if}
</div>

<style>
	.arquivo input { margin-top: 0.4rem; width: auto; }
	.link { margin-top: 0.9rem; }
	.linha { display: flex; gap: 0.5rem; align-items: stretch; }
	.linha input { flex: 1; margin: 0; }
	.linha button { margin: 0; white-space: nowrap; }
</style>
