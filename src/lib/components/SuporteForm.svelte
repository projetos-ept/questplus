<script lang="ts">
	import { goto } from '$app/navigation';
	import { DISCIPLINAS, ehDisciplina } from '#lib/disciplinas';
	import { reduzir } from '#lib/imagem';
	import { MAX_IMAGENS, ROTULO_TAMANHO, imagensDe, proximoNumero, slugDe, type ImagemSuporte, type Tamanho } from '#lib/imagens';
	import { diagramas } from '#lib/diagramas';
	import { renderSuporte } from '#lib/suporte';
	import { protegerSaida } from '#lib/saida';
	import { untrack } from 'svelte';
	import ConfirmarModal from './ConfirmarModal.svelte';

	import { normalizarEtiquetas } from '#lib/questao';
	type Valor = { titulo: string; texto: string; imagens?: ImagemSuporte[]; imagem_chave?: string | null; etiquetas?: string[] };
	let { id = null, inicial, emUso = 0 }: { id?: number | null; inicial: Valor; emUso?: number } = $props();

	let titulo = $state(untrack(() => inicial.titulo));
	let texto = $state(untrack(() => inicial.texto));
	// a primeira etiqueta é a disciplina (lista do curso); as outras são o assunto
	const primeira = untrack(() => inicial.etiquetas?.[0]);
	let disciplina = $state(primeira && ehDisciplina(primeira) ? primeira : '');
	let etiquetas = $state(untrack(() => (disciplina ? (inicial.etiquetas ?? []).slice(1) : (inicial.etiquetas ?? [])).join(', ')));
	let imagens = $state<ImagemSuporte[]>(untrack(() => structuredClone($state.snapshot(imagensDe(inicial)))));
	let erros = $state<string[]>([]);
	let salvando = $state(false);
	let enviando = $state(false);
	let link = $state('');
	let area: HTMLTextAreaElement | undefined = $state();
	let modal: ConfirmarModal;
	let ciente = $state(false);
	const estadoAtual = () => JSON.stringify([titulo, texto, disciplina, etiquetas, $state.snapshot(imagens)]);
	const original = untrack(estadoAtual);
	let salvo = false;
	protegerSaida(() => !salvo && estadoAtual() !== original);

	const previa = $derived(renderSuporte(texto, imagens));
	const cheio = $derived(imagens.length >= MAX_IMAGENS);

	function acrescentar(chave: string, origem: string | null) {
		const n = proximoNumero(imagens);
		if (n === null) return;
		imagens.push({ n, chave, legenda: '', tamanho: 'media', largura: null, origem });
	}

	async function enviarArquivos(e: Event) {
		const input = e.currentTarget as HTMLInputElement;
		const arquivos = [...(input.files ?? [])];
		erros = [];
		enviando = true;
		try {
			for (const arquivo of arquivos) {
				if (cheio) {
					erros = [`Limite de ${MAX_IMAGENS} imagens por texto de apoio.`];
					break;
				}
				const dados = new FormData();
				dados.set('arquivo', await reduzir(arquivo));
				const r = await fetch('/api/admin/midia', { method: 'POST', body: dados });
				const corpo = (await r.json().catch(() => ({}))) as { chave?: string; erros?: string[] };
				if (!r.ok || !corpo.chave) {
					erros = [`${arquivo.name}: ${corpo.erros?.[0] ?? 'não foi possível enviar.'}`];
					break;
				}
				acrescentar(corpo.chave, null);
			}
		} catch {
			erros = ['Falha de conexão ao enviar a imagem.'];
		} finally {
			enviando = false;
			input.value = '';
		}
	}

	async function baixarLink() {
		if (!link.trim()) return;
		erros = [];
		enviando = true;
		try {
			const r = await fetch('/api/admin/midia/importar-url', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ url: link.trim() }) });
			const corpo = (await r.json().catch(() => ({}))) as { chave?: string; origem?: string; erros?: string[] };
			if (!r.ok || !corpo.chave) erros = [corpo.erros?.[0] ?? 'Não foi possível baixar a imagem desse link.'];
			else {
				acrescentar(corpo.chave, corpo.origem ?? link.trim());
				link = '';
			}
		} catch {
			erros = ['Falha de conexão ao baixar a imagem.'];
		} finally {
			enviando = false;
		}
	}

	function inserirNoTexto(n: number) {
		const marca = slugDe(n);
		const ini = area?.selectionStart ?? texto.length;
		const fim = area?.selectionEnd ?? texto.length;
		texto = texto.slice(0, ini) + marca + texto.slice(fim);
		queueMicrotask(() => {
			area?.focus();
			area?.setSelectionRange(ini + marca.length, ini + marca.length);
		});
	}

	async function salvar(e: SubmitEvent) {
		e.preventDefault();
		erros = [];
		salvando = true;
		try {
			const r = await fetch(id ? `/api/admin/suportes/${id}` : '/api/admin/suportes', {
				method: id ? 'PUT' : 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ titulo, texto, imagens: $state.snapshot(imagens), etiquetas: [...new Set([...(disciplina ? [disciplina] : []), ...normalizarEtiquetas(etiquetas)])] })
			});
			const corpo = (await r.json().catch(() => ({}))) as { erros?: string[] };
			if (!r.ok) erros = corpo.erros ?? ['Não foi possível salvar.'];
			else {
				salvo = true;
				await goto('/admin/suportes');
			}
		} catch {
			erros = ['Falha de conexão. Tente de novo.'];
		} finally {
			salvando = false;
		}
	}

	function pedirExclusao() {
		ciente = false;
		modal.abrir();
	}
	async function excluir(): Promise<string | void> {
		const r = await fetch(`/api/admin/suportes/${id}${emUso > 0 ? '?desvincular=1' : ''}`, { method: 'DELETE' });
		if (r.ok) {
			salvo = true;
			return void (await goto('/admin/suportes'));
		}
		return ((await r.json().catch(() => ({}))) as { erros?: string[] }).erros?.[0] ?? 'Não foi possível excluir.';
	}
</script>

<form onsubmit={salvar} class="cartao">
	<label>Título <input bind:value={titulo} required maxlength="200" /></label>
	<div class="duas-etq">
		<label>Disciplina {#if !id}<span class="suave">(obrigatória: vira a primeira etiqueta)</span>{/if}
			<select bind:value={disciplina} required={!id}>
				<option value="" disabled={!id}>{id ? 'Sem disciplina (texto antigo)' : 'Escolha…'}</option>
				{#each DISCIPLINAS as d}<option value={d.id}>{d.nome}</option>{/each}
			</select>
		</label>
		<label>Outras etiquetas (assunto, separadas por vírgula) <input bind:value={etiquetas} placeholder="coleta, pré-analítica" /></label>
	</div>

	<div class="duas">
		<label>Texto (Markdown simples: **negrito**, *itálico*, listas, [link](https://…))
			<textarea bind:this={area} bind:value={texto} maxlength="20000" rows="12"></textarea>
		</label>
		<div>
			<span class="rotulo">Prévia</span>
			<div class="previa" aria-live="polite" use:diagramas={previa.html}>{@html previa.html || '<p class="suave">A prévia aparece aqui.</p>'}</div>
		</div>
	</div>
	{#if previa.semImagem.length}
		<p class="aviso" role="status">⚠ {previa.semImagem.join(', ')} no texto, mas não há imagem com esse número.</p>
	{/if}
	{#if previa.naoCitadas.length}
		<p class="suave">As imagens {previa.naoCitadas.join(', ')} não aparecem no texto e serão mostradas no final. Para posicioná-las, escreva o código (ex.: <code>{previa.naoCitadas[0]}</code>) onde quiser.</p>
	{/if}

	<fieldset class="imagens">
		<legend>Imagens ({imagens.length} de {MAX_IMAGENS})</legend>
		<p class="suave">Cada imagem tem um código, como <code>[img1]</code>. Escreva o código no texto, no lugar onde a imagem deve aparecer.</p>

		<ul class="cartoes">
			{#each imagens as img (img.n)}
				<li class="imagem">
					<div class="miniatura">
						<img src="/midia/{img.chave}" alt={img.legenda || `Imagem ${img.n}`} />
					</div>
					<div class="campos">
						<div class="topo-img">
							<code class="slug">{slugDe(img.n)}</code>
							<button type="button" class="sec" onclick={() => inserirNoTexto(img.n)}>Inserir no texto</button>
							<button type="button" class="sec perigo" onclick={() => imagens.splice(imagens.indexOf(img), 1)}>Remover imagem</button>
						</div>
						<label>Legenda <span class="suave">(aparece abaixo da imagem)</span>
							<textarea bind:value={img.legenda} rows="2" maxlength="300"></textarea>
						</label>
						<div class="tamanho">
							<label>Tamanho
								<select bind:value={img.tamanho}>
									{#each Object.entries(ROTULO_TAMANHO) as [valor, rotulo]}<option value={valor}>{rotulo}</option>{/each}
								</select>
							</label>
							{#if img.tamanho === 'personalizada'}
								<label>Largura (px)
									<input type="number" min="50" max="1600" step="10" bind:value={img.largura} required placeholder="300" />
								</label>
							{/if}
						</div>
						{#if img.origem}<p class="suave origem">Fonte: <a href={img.origem} target="_blank" rel="noopener noreferrer">{img.origem}</a></p>{/if}
					</div>
				</li>
			{/each}
		</ul>

		{#if !cheio}
			<div class="adicionar">
				<label class="arquivo">Enviar arquivo(s) <span class="suave">(PNG, JPG, WEBP ou GIF até 2 MB; reduzida no navegador)</span>
					<input type="file" multiple accept="image/png,image/jpeg,image/webp,image/gif" onchange={enviarArquivos} disabled={enviando} />
				</label>
				<div class="link">
					<label for="link-img">…ou cole o endereço da imagem <span class="suave">(o sistema baixa e guarda uma cópia)</span></label>
					<div class="linha">
						<input id="link-img" type="url" bind:value={link} placeholder="https://…/imagem.png" disabled={enviando} onkeydown={(e) => { if (e.key === 'Enter') { e.preventDefault(); baixarLink(); } }} />
						<button type="button" class="sec" onclick={baixarLink} disabled={enviando || !link.trim()}>Baixar e anexar</button>
					</div>
				</div>
				{#if enviando}<p class="suave" role="status">Enviando…</p>{/if}
			</div>
		{:else}
			<p class="suave">Limite de {MAX_IMAGENS} imagens atingido. Remova uma para adicionar outra.</p>
		{/if}
	</fieldset>

	{#if erros.length}
		<ul class="erro" role="alert">{#each erros as e}<li>{e}</li>{/each}</ul>
	{/if}

	<div class="acoes">
		<button type="submit" disabled={salvando || enviando}>{salvando ? 'Salvando…' : 'Salvar'}</button>
		<a href="/admin/suportes">Cancelar</a>
		{#if id}<button type="button" class="sec perigo" onclick={pedirExclusao} style="margin-left:auto">Excluir texto de apoio</button>{/if}
	</div>
</form>

<ConfirmarModal bind:this={modal} titulo="Excluir este texto de apoio?" rotuloConfirmar="Excluir texto de apoio" perigo bloqueado={emUso > 0 && !ciente} onconfirmar={excluir}>
	<p class="resumo"><strong>{titulo}</strong>{imagens.length ? ` · ${imagens.length} imagem(ns)` : ''}</p>
	<p>Esta ação <strong>não pode ser desfeita</strong>. As imagens também são apagadas.</p>
	{#if emUso > 0}
		<p class="aviso-uso">Há <strong>{emUso} atividade(s)</strong> usando este texto. Elas continuam existindo, mas ficam sem texto de apoio (provas já feitas guardam a própria cópia).</p>
		<label class="ciente"><input type="checkbox" bind:checked={ciente} /> Entendo que as {emUso} atividade(s) ficarão sem texto de apoio.</label>
	{/if}
	<p class="suave">Provas já feitas guardam uma cópia do texto e das imagens e não são afetadas.</p>
</ConfirmarModal>

<style>
	.duas-etq { display: grid; grid-template-columns: repeat(auto-fit, minmax(14rem, 1fr)); gap: 0 1rem; }
	.duas { display: grid; grid-template-columns: repeat(auto-fit, minmax(18rem, 1fr)); gap: 0 1rem; }
	.rotulo { display: block; margin-top: 1rem; font-weight: 600; }
	.previa { min-height: 6rem; margin-top: 0.25rem; padding: 0.6rem; overflow-wrap: anywhere; background: var(--fundo); border: 1px dashed var(--borda); border-radius: 0.4rem; }
	.aviso { padding: 0.5rem 0.75rem; border: 1px solid var(--erro); border-radius: 0.4rem; }
	.imagens { margin: 1.25rem 0 0; padding: 0.75rem 1rem 1rem; border: 1px solid var(--borda); border-radius: 0.5rem; }
	legend { padding: 0 0.4rem; font-weight: 600; }
	.cartoes { padding: 0; margin: 0; list-style: none; display: grid; gap: 1rem; }
	.imagem { display: grid; grid-template-columns: minmax(8rem, 12rem) 1fr; gap: 1rem; padding: 0.75rem; background: var(--fundo); border: 1px solid var(--borda); border-radius: 0.5rem; }
	@media (max-width: 40rem) { .imagem { grid-template-columns: 1fr; } }
	.miniatura { display: flex; align-items: flex-start; justify-content: center; }
	.miniatura img { max-width: 100%; max-height: 11rem; border-radius: 0.3rem; }
	.topo-img { display: flex; flex-wrap: wrap; gap: 0.5rem; align-items: center; }
	.topo-img button { margin: 0; padding: 0.3rem 0.7rem; font-size: 0.85rem; }
	.slug { padding: 0.15rem 0.5rem; font-weight: 700; border: 1px solid var(--borda); border-radius: 0.3rem; background: var(--superficie); }
	.campos label { margin-top: 0.6rem; font-weight: 600; }
	.tamanho { display: flex; flex-wrap: wrap; gap: 0 1rem; }
	.tamanho label { flex: 1 1 10rem; }
	.origem { margin: 0.5rem 0 0; overflow-wrap: anywhere; font-size: 0.85rem; }
	.adicionar { margin-top: 1rem; padding-top: 0.75rem; border-top: 1px solid var(--borda); }
	.arquivo input { margin-top: 0.4rem; width: auto; }
	.link { margin-top: 0.9rem; }
	.linha { display: flex; gap: 0.5rem; align-items: stretch; }
	.linha input { flex: 1; margin: 0; }
	.linha button { margin: 0; white-space: nowrap; }
	.acoes { display: flex; flex-wrap: wrap; gap: 1rem; align-items: center; margin-top: 0.5rem; }
	.perigo { color: var(--erro); border-color: var(--erro); }
	.resumo { padding: 0.5rem 0.75rem; overflow-wrap: anywhere; background: var(--fundo); border-radius: 0.4rem; }
	.aviso-uso { padding: 0.5rem 0.75rem; border: 1px solid var(--erro); border-radius: 0.4rem; }
	.ciente { display: flex; gap: 0.5rem; align-items: flex-start; font-weight: 400; }
</style>
