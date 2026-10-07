<script lang="ts">
	import type { Snippet } from 'svelte';
	import { nomeDaDisciplina, ehDisciplina } from '#lib/disciplinas';
	import { imagemDe } from '#lib/imagens';
	import FiguraQuestao from './FiguraQuestao.svelte';
	import { formatoDe, type Aberta, type Mc, type Vf } from '#lib/questao';

	export type QuestaoItem = {
		id: number;
		tipo: string;
		enunciado: string;
		config?: unknown;
		explicacao?: string | null;
		pontos: number;
		etiquetas: string[];
		ativa?: boolean;
		em_atividades?: number;
	};

	let { q, inicio, acoes, jaAdicionada = false }: { q: QuestaoItem; inicio?: Snippet; acoes?: Snippet; jaAdicionada?: boolean } = $props();
	const LETRAS = ['A', 'B', 'C', 'D', 'E'];
	const disciplina = $derived(q.etiquetas[0] && ehDisciplina(q.etiquetas[0]) ? q.etiquetas[0] : null);
	const outras = $derived(q.etiquetas.filter((e) => e !== disciplina));
	const imagem = $derived(imagemDe(q.config));
	let aberto = $state(false);
	const resumo = (t: string) => (t.length > 180 ? `${t.slice(0, 180)}…` : t);
</script>

<article class="item" class:inativa={q.ativa === false} class:ja={jaAdicionada}>
	{#if inicio}<div class="inicio">{@render inicio()}</div>{/if}
	<div class="corpo">
		<div class="meta">
			<span class="formato">{formatoDe(q.tipo, q.config ?? { alternativas: [] })}</span>
			<span class="suave">{q.pontos} ponto{q.pontos === 1 ? '' : 's'}</span>
			{#if disciplina}<span class="disc">{nomeDaDisciplina(disciplina)}</span>{/if}
			{#if imagem}<span class="suave" title="Tem imagem">🖼 imagem</span>{/if}
			{#if (q.em_atividades ?? 0) > 0}<span class="suave" title="Está em atividades">em {q.em_atividades} atividade{q.em_atividades === 1 ? '' : 's'}</span>{/if}
			{#if q.ativa === false}<span class="selo">Inativa</span>{/if}
			{#if jaAdicionada}<span class="selo ok">✔ já adicionada</span>{/if}
		</div>
		<p class="enun">{aberto ? q.enunciado : resumo(q.enunciado)}</p>
		{#if outras.length}<div class="tags">{#each outras as e}<span class="etiqueta">{e}</span>{/each}</div>{/if}
		{#if q.config !== undefined}
			<button type="button" class="ver" aria-expanded={aberto} onclick={() => (aberto = !aberto)}>{aberto ? 'Ocultar' : 'Ver questão e gabarito'}</button>
			{#if aberto}
				<div class="detalhe">
					<FiguraQuestao {imagem} />
					{#if q.tipo === 'mc'}
						<ol class="alts">
							{#each (q.config as Mc).alternativas as alt, k}
								<li class:certa={(q.config as Mc).correta === k}>{LETRAS[k]}) {alt}{#if (q.config as Mc).correta === k}<strong class="gab">✔ gabarito</strong>{/if}</li>
							{/each}
						</ol>
					{:else if q.tipo === 'aberta'}
						<p><strong>Referência:</strong> {(q.config as Aberta).referencia}</p>
						<p class="suave">Conceitos: {(q.config as Aberta).conceitos.map((c) => c.nome).join(' · ')}</p>
					{:else}
						<ul class="alts">
							{#each (q.config as Vf).afirmacoes as af}<li>{af.texto} — <strong>{af.valor ? 'Verdadeira' : 'Falsa'}</strong></li>{/each}
						</ul>
					{/if}
					{#if q.explicacao}<p class="suave"><em>Explicação:</em> {q.explicacao}</p>{/if}
				</div>
			{/if}
		{/if}
	</div>
	{#if acoes}<div class="acoes">{@render acoes()}</div>{/if}
</article>

<style>
	.item { display: flex; gap: 0.75rem; align-items: flex-start; padding: 0.75rem 0.25rem; border-bottom: 1px solid var(--borda); }
	.item.inativa .corpo { opacity: 0.65; }
	.item.ja .corpo { opacity: 0.6; }
	.inicio { padding-top: 0.15rem; }
	.corpo { flex: 1; min-width: 0; }
	.meta { display: flex; flex-wrap: wrap; gap: 0.35rem 0.6rem; align-items: center; font-size: 0.85rem; }
	.formato { padding: 0 0.4rem; font-size: 0.75rem; font-weight: 700; border: 1px solid var(--borda); border-radius: 0.3rem; }
	.disc { padding: 0 0.5rem; font-size: 0.78rem; font-weight: 600; color: var(--sobre-primaria); background: var(--primaria); border-radius: 1rem; }
	.selo { padding: 0 0.5rem; font-size: 0.78rem; border: 1px solid var(--borda); border-radius: 1rem; }
	.selo.ok { border-color: var(--sucesso, var(--primaria)); }
	.enun { margin: 0.3rem 0; overflow-wrap: anywhere; white-space: pre-wrap; }
	.tags { margin-bottom: 0.2rem; }
	.ver { display: inline; margin: 0; padding: 0; font-size: 0.85rem; font-weight: 400; color: var(--primaria); text-decoration: underline; background: none; border: 0; }
	.detalhe { margin-top: 0.4rem; padding: 0.6rem 0.8rem; background: var(--fundo); border: 1px solid var(--borda); border-radius: 0.4rem; }
	.alts { margin: 0.25rem 0; padding-left: 0; list-style: none; }
	.alts li.certa { font-weight: 600; }
	.gab { margin-left: 0.5rem; }
	.acoes { display: flex; flex-wrap: wrap; gap: 0.3rem; justify-content: flex-end; max-width: 15rem; }
	.acoes :global(button), .acoes :global(a) { margin: 0; padding: 0.3rem 0.6rem; font-size: 0.85rem; }
	@media (max-width: 40rem) { .item { flex-wrap: wrap; } .acoes { max-width: none; justify-content: flex-start; } }
</style>
