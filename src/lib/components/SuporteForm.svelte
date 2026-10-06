<script lang="ts">
	import { goto } from '$app/navigation';
	import { reduzir } from '#lib/imagem';
	import { renderMarkdown } from '#lib/markdown';
	import { untrack } from 'svelte';

	type Valor = { titulo: string; texto: string; imagem_chave: string | null };
	let { id = null, inicial, emUso = 0 }: { id?: number | null; inicial: Valor; emUso?: number } = $props();

	let titulo = $state(untrack(() => inicial.titulo));
	let texto = $state(untrack(() => inicial.texto));
	let imagem = $state<string | null>(untrack(() => inicial.imagem_chave));
	let erros = $state<string[]>([]);
	let salvando = $state(false);
	let enviando = $state(false);

	const previa = $derived(renderMarkdown(texto));

	async function escolherImagem(e: Event) {
		const input = e.currentTarget as HTMLInputElement;
		const arquivo = input.files?.[0];
		if (!arquivo) return;
		erros = [];
		enviando = true;
		try {
			const dados = new FormData();
			dados.set('arquivo', await reduzir(arquivo));
			const r = await fetch('/api/admin/midia', { method: 'POST', body: dados });
			const corpo = (await r.json().catch(() => ({}))) as { chave?: string; erros?: string[] };
			if (!r.ok || !corpo.chave) erros = corpo.erros ?? ['Não foi possível enviar a imagem.'];
			else imagem = corpo.chave;
		} catch {
			erros = ['Falha de conexão ao enviar a imagem.'];
		} finally {
			enviando = false;
			input.value = '';
		}
	}

	async function salvar(e: SubmitEvent) {
		e.preventDefault();
		erros = [];
		salvando = true;
		try {
			const r = await fetch(id ? `/api/admin/suportes/${id}` : '/api/admin/suportes', {
				method: id ? 'PUT' : 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ titulo, texto, imagem_chave: imagem })
			});
			const corpo = (await r.json().catch(() => ({}))) as { erros?: string[] };
			if (!r.ok) erros = corpo.erros ?? ['Não foi possível salvar.'];
			else await goto('/admin/suportes');
		} catch {
			erros = ['Falha de conexão. Tente de novo.'];
		} finally {
			salvando = false;
		}
	}

	async function excluir() {
		if (!id || !confirm('Excluir este texto de apoio? A imagem também será apagada.')) return;
		erros = [];
		const r = await fetch(`/api/admin/suportes/${id}`, { method: 'DELETE' });
		const corpo = (await r.json().catch(() => ({}))) as { erros?: string[] };
		if (r.ok) await goto('/admin/suportes');
		else erros = corpo.erros ?? ['Não foi possível excluir.'];
	}
</script>

<form onsubmit={salvar} class="cartao">
	<label>Título <input bind:value={titulo} required maxlength="200" /></label>

	<div class="duas">
		<label>Texto (Markdown simples: **negrito**, *itálico*, listas, [link](https://…))
			<textarea bind:value={texto} maxlength="20000" rows="10"></textarea>
		</label>
		<div>
			<span class="rotulo">Prévia</span>
			<div class="previa" aria-live="polite">{@html previa || '<p class="suave">A prévia aparece aqui.</p>'}</div>
		</div>
	</div>

	<div class="imagem">
		<span class="rotulo">Imagem (PNG, JPG, WEBP ou GIF, até 2 MB; reduzida no navegador)</span>
		{#if imagem}
			<img src="/midia/{imagem}" alt="Imagem do texto de apoio" />
			<button type="button" class="sec" onclick={() => (imagem = null)}>Remover imagem</button>
		{/if}
		<input type="file" accept="image/png,image/jpeg,image/webp,image/gif" onchange={escolherImagem} disabled={enviando} />
		{#if enviando}<p class="suave">Enviando…</p>{/if}
	</div>

	{#if erros.length}
		<ul class="erro" role="alert">{#each erros as e}<li>{e}</li>{/each}</ul>
	{/if}

	<div class="acoes">
		<button type="submit" disabled={salvando || enviando}>{salvando ? 'Salvando…' : 'Salvar'}</button>
		<a href="/admin/suportes">Cancelar</a>
		{#if id}
			<button type="button" class="sec perigo" onclick={excluir} disabled={emUso > 0} title={emUso > 0 ? `Usado por ${emUso} questão(ões)` : ''}>Excluir</button>
		{/if}
	</div>
	{#if id && emUso > 0}<p class="suave">Usado por {emUso} questão(ões); desvincule-as antes de excluir.</p>{/if}
</form>

<style>
	.duas {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(18rem, 1fr));
		gap: 0 1rem;
	}
	.rotulo {
		display: block;
		margin-top: 1rem;
		font-weight: 600;
	}
	.previa {
		min-height: 6rem;
		margin-top: 0.25rem;
		padding: 0.6rem;
		overflow-wrap: anywhere;
		background: var(--fundo);
		border: 1px dashed var(--borda);
		border-radius: 0.4rem;
	}
	.imagem img {
		display: block;
		max-width: 100%;
		max-height: 18rem;
		margin-top: 0.5rem;
		border-radius: 0.4rem;
	}
	.imagem input {
		margin-top: 0.5rem;
	}
	.acoes {
		display: flex;
		flex-wrap: wrap;
		gap: 1rem;
		align-items: center;
	}
	.perigo {
		margin-left: auto;
		color: var(--erro);
		border-color: var(--erro);
	}
</style>
