<script lang="ts">
	import { untrack } from 'svelte';
	import { diagramas } from '#lib/diagramas';
	import { nomeDaDisciplina, ehDisciplina, DISCIPLINAS } from '#lib/disciplinas';
	import { imagensDe } from '#lib/imagens';
	import { renderSuporte } from '#lib/suporte';

	type Resumo = { id: number; titulo: string; etiquetas: string[]; caracteres: number; imagens: number };
	let { valor = $bindable(), tituloInicial = '' }: { valor: number | null; tituloInicial?: string } = $props();

	let titulo = $state(untrack(() => tituloInicial));
	let aberto = $state(false);
	let busca = $state('');
	let disciplina = $state('');
	let itens = $state<Resumo[]>([]);
	let buscando = $state(false);
	let erro = $state('');
	let previa = $state<{ titulo: string; texto: string; imagens: ReturnType<typeof imagensDe> } | null>(null);
	let temporizador: ReturnType<typeof setTimeout>;
	let consulta: AbortController | undefined;

	async function buscar() {
		consulta?.abort();
		consulta = new AbortController();
		buscando = true;
		erro = '';
		const p = new URLSearchParams();
		if (busca.trim()) p.set('q', busca.trim());
		if (disciplina) p.set('disciplina', disciplina);
		try {
			const r = await fetch(`/api/admin/suportes/resumo?${p}`, { signal: consulta.signal });
			if (!r.ok) throw new Error();
			itens = ((await r.json()) as { itens: Resumo[] }).itens;
			buscando = false;
		} catch (e) {
			if ((e as Error).name === 'AbortError') return;
			erro = 'Não foi possível buscar os textos de apoio.';
			buscando = false;
		}
	}
	function agendar() {
		clearTimeout(temporizador);
		temporizador = setTimeout(buscar, 250);
	}
	function abrir() {
		aberto = true;
		buscar();
	}
	function escolher(s: Resumo) {
		valor = s.id;
		titulo = s.titulo;
		aberto = false;
		previa = null;
	}
	function remover() {
		valor = null;
		titulo = '';
		previa = null;
	}
	/** Mostra o texto como o aluno verá (com imagens e diagramas). */
	async function verPrevia(id: number) {
		if (previa) return void (previa = null);
		const r = await fetch(`/api/admin/suportes/${id}`);
		if (!r.ok) return void (erro = 'Não foi possível abrir a prévia.');
		const s = (await r.json()) as { titulo: string; texto: string; imagens?: ReturnType<typeof imagensDe>; imagem_chave?: string | null };
		previa = { titulo: s.titulo, texto: s.texto, imagens: imagensDe(s) };
	}
	const disciplinaDe = (e: string[]) => (e[0] && ehDisciplina(e[0]) ? nomeDaDisciplina(e[0]) : null);
</script>

<fieldset class="apoio">
	<legend>Texto de apoio (opcional)</legend>
	<p class="suave">Aparece antes da questão 1, para o aluno ler e consultar durante a atividade. Cada atividade tem no máximo um.</p>
	{#if valor !== null}
		<div class="escolhido">
			<span><strong>{titulo || `Texto #${valor}`}</strong></span>
			<button type="button" class="sec" onclick={() => verPrevia(valor!)}>{previa ? 'Ocultar prévia' : 'Ver prévia'}</button>
			<button type="button" class="sec" onclick={abrir}>Trocar</button>
			<button type="button" class="sec perigo" onclick={remover}>Tirar</button>
		</div>
		{#if previa}
			<div class="previa" use:diagramas={previa.texto}>
				<strong>{previa.titulo}</strong>
				{@html renderSuporte(previa.texto, previa.imagens).html}
			</div>
		{/if}
	{:else}
		<p><span class="suave">Sem texto de apoio.</span> <button type="button" class="sec" onclick={abrir}>Escolher um texto de apoio</button></p>
	{/if}

	{#if aberto}
		<div class="painel cartao">
			<div class="filtros">
				<label>Busca <input type="search" bind:value={busca} oninput={agendar} placeholder="Título ou trecho" /></label>
				<label>Disciplina
					<select bind:value={disciplina} onchange={buscar}>
						<option value="">Todas</option>
						{#each DISCIPLINAS as d}<option value={d.id}>{d.nome}</option>{/each}
					</select>
				</label>
				<button type="button" class="sec fechar" onclick={() => (aberto = false)}>Fechar</button>
			</div>
			{#if erro}<p class="erro" role="alert">{erro}</p>{/if}
			<ul class="lista" aria-busy={buscando}>
				{#each itens as s (s.id)}
					<li class:atual={s.id === valor}>
						<div>
							<strong>{s.titulo}</strong>
							<div class="suave meta">
								{#if disciplinaDe(s.etiquetas)}{disciplinaDe(s.etiquetas)} · {/if}{s.caracteres} caracteres{#if s.imagens} · 🖼 {s.imagens}{/if}
							</div>
						</div>
						<button type="button" class="sec" onclick={() => escolher(s)} disabled={s.id === valor}>{s.id === valor ? 'Escolhido' : 'Escolher'}</button>
					</li>
				{:else}
					{#if !buscando}<li class="suave">Nenhum texto de apoio encontrado. <a href="/admin/suportes/nova" target="_blank" rel="noopener">Cadastrar um novo</a></li>{/if}
				{/each}
			</ul>
		</div>
	{/if}
</fieldset>

<style>
	.apoio { margin: 1rem 0 0; padding: 0.75rem 1rem 1rem; border: 1px solid var(--borda); border-radius: 0.5rem; }
	legend { padding: 0 0.4rem; font-weight: 600; }
	.escolhido { display: flex; flex-wrap: wrap; gap: 0.5rem 0.75rem; align-items: center; }
	.escolhido button { margin: 0; padding: 0.3rem 0.7rem; font-size: 0.85rem; }
	.perigo { color: var(--erro); border-color: var(--erro); }
	.previa { margin-top: 0.75rem; padding: 0.6rem 0.8rem; overflow-wrap: anywhere; background: var(--fundo); border: 1px dashed var(--borda); border-radius: 0.4rem; }
	.painel { margin-top: 0.75rem; }
	.filtros { display: grid; grid-template-columns: 2fr 1fr auto; gap: 0 0.75rem; align-items: end; }
	.fechar { margin: 0; padding: 0.5rem 0.9rem; }
	@media (max-width: 40rem) { .filtros { grid-template-columns: 1fr; } }
	.lista { padding: 0; margin: 0.5rem 0 0; max-height: 18rem; overflow-y: auto; list-style: none; }
	.lista li { display: flex; gap: 0.75rem; align-items: center; justify-content: space-between; padding: 0.5rem 0.25rem; border-bottom: 1px solid var(--borda); }
	.lista li.atual { background: var(--fundo); }
	.lista button { margin: 0; padding: 0.3rem 0.7rem; font-size: 0.85rem; }
	.meta { font-size: 0.85rem; }
</style>
