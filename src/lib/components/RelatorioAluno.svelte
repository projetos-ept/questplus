<script lang="ts">
	import { imagensDe } from '#lib/imagens';
	import { formatarData } from '#lib/data';
	import { formatarTempo } from '#lib/relatorio';
	import { renderSuporte } from '#lib/suporte';
	import type { Aberta, Mc, Vf } from '#lib/questao';
	import type { QuestaoSnapshot } from '#lib/atividade';

	export type DadosRelatorio = {
		id: number;
		atividade: { titulo: string; codigo: string; modo: string };
		aluno: { nome: string; email: string; turma: string };
		status: string;
		anulada: boolean;
		inicio_em: string;
		finalizada_em: string | null;
		tempoSegundos: number | null;
		nota: number;
		pontosMax: number;
		percentual: number;
		tentativaNumero: number;
		tentativasTotal: number;
		melhor: boolean;
		questoes: QuestaoSnapshot[];
		respostas: Record<number, { resposta: { escolha?: number; valores?: (boolean | null)[]; texto?: string }; pontos_final: number | null; pendente?: boolean; nivel_final?: number | null; justificativa?: string | null; aproximacao?: number | null }>;
	};

	let { dados, gabarito = true, apoio = true }: { dados: DadosRelatorio; gabarito?: boolean; apoio?: boolean } = $props();

	const LETRAS = ['A', 'B', 'C', 'D', 'E'];
	const pts = (n: number) => String(Math.round(n * 100) / 100).replace('.', ',');
	const textoVF = (v: boolean | null | undefined) => (v === true ? 'Verdadeiro' : v === false ? 'Falso' : 'Em branco');
</script>

<article class="relatorio">
	<header class="cab">
		<p class="suave marca">QuestPlus · Relatório individual</p>
		<h2>{dados.atividade.titulo}</h2>
		<dl>
			<div><dt>Aluno</dt><dd>{dados.aluno.nome}</dd></div>
			<div><dt>Turma</dt><dd>{dados.aluno.turma}</dd></div>
			<div><dt>E-mail</dt><dd>{dados.aluno.email}</dd></div>
			<div><dt>Modo</dt><dd>{dados.atividade.modo === 'prova' ? 'Prova' : 'Treino'}</dd></div>
			<div><dt>Início</dt><dd>{formatarData(dados.inicio_em)}</dd></div>
			<div><dt>Tempo gasto</dt><dd>{formatarTempo(dados.tempoSegundos)}</dd></div>
			<div><dt>Tentativa</dt><dd>{dados.tentativaNumero} de {dados.tentativasTotal}{dados.melhor && dados.tentativasTotal > 1 ? ' (maior nota)' : ''}</dd></div>
		</dl>
		<p class="nota">
			Nota: <strong>{pts(dados.nota)} de {pts(dados.pontosMax)} pontos</strong> ({String(dados.percentual).replace('.', ',')}%)
			{#if dados.anulada}<span class="aviso">Tentativa anulada</span>{:else if dados.status !== 'finalizada'}<span class="aviso">Em andamento</span>{/if}
		</p>
	</header>

	{#each dados.questoes as q, i (q.id)}
		{@const r = dados.respostas[q.id]}
		{@const ganhos = r?.pontos_final ?? 0}
		<section class="questao nao-quebrar">
			<h3>
				Questão {i + 1}
				<span class="pontos">{r?.pendente ? `Aguardando correção do professor · 0 de ${pts(q.pontos)} por enquanto` : r ? `${pts(ganhos)} de ${pts(q.pontos)} ponto(s)` : `Sem resposta · 0 de ${pts(q.pontos)}`}</span>
			</h3>
			{#if apoio && q.suporte}
				<div class="apoio">
					<strong>{q.suporte.titulo}</strong>
					<div class="md">{@html renderSuporte(q.suporte.texto, imagensDe(q.suporte)).html}</div>
				</div>
			{/if}
			<p class="enunciado">{q.enunciado}</p>

			{#if q.tipo === 'mc'}
				{@const c = q.config as Mc}
				<ol class="alternativas">
					{#each c.alternativas as alt, k}
						{@const escolhida = r?.resposta.escolha === k}
						{@const correta = gabarito && c.correta === k}
						<li class:escolhida class:correta>
							<span class="marca-alt">{escolhida ? '◉' : '○'}</span>
							<span class="letra">{LETRAS[k]})</span>
							<span class="t">{alt}</span>
							{#if escolhida}<span class="rotulo">resposta do aluno</span>{/if}
							{#if correta}<span class="rotulo">✔ gabarito</span>{/if}
						</li>
					{/each}
				</ol>
				{#if !r}<p class="suave">O aluno não respondeu esta questão.</p>{/if}
			{:else if q.tipo === 'aberta'}
				{@const c = q.config as Aberta}
				<p class="rotulo">Resposta do aluno</p>
				<blockquote class="texto-aberta">{r?.resposta.texto ?? 'O aluno não respondeu esta questão.'}</blockquote>
				{#if r && !r.pendente && r.nivel_final !== null && r.nivel_final !== undefined}<p class="suave">Nível confirmado pelo professor: {r.nivel_final} de 4.</p>{/if}
				{#if gabarito}
					<p class="rotulo">✔ Resposta de referência</p>
					<blockquote class="texto-aberta">{c.referencia}</blockquote>
					{#if r?.justificativa}<p class="suave"><em>Observação da correção:</em> {r.justificativa}</p>{/if}
				{/if}
			{:else}
				{@const c = q.config as Vf}
				<table class="vf">
					<thead><tr><th>Afirmação</th><th>Aluno</th>{#if gabarito}<th>Gabarito</th><th>Resultado</th>{/if}</tr></thead>
					<tbody>
						{#each c.afirmacoes as af, k}
							{@const dada = r?.resposta.valores?.[k] ?? null}
							<tr>
								<td>{af.texto}</td>
								<td>{textoVF(dada)}</td>
								{#if gabarito}<td>{textoVF(af.valor)}</td><td>{dada === af.valor ? '✔ Acertou' : '✘ Não pontuou'}</td>{/if}
							</tr>
						{/each}
					</tbody>
				</table>
			{/if}

			{#if gabarito && q.explicacao}<p class="explicacao"><em>Explicação:</em> {q.explicacao}</p>{/if}
		</section>
	{/each}
</article>

<style>
	.relatorio { max-width: 52rem; margin: 0 auto; }
	.texto-aberta { margin: 0.25rem 0 0.75rem; padding: 0.5rem 0.75rem; white-space: pre-wrap; overflow-wrap: anywhere; border-left: 3px solid var(--borda); }
	.marca { margin: 0; font-size: 0.85rem; }
	h2 { margin: 0.1rem 0 0.5rem; font-size: 1.4rem; }
	dl { display: grid; grid-template-columns: repeat(auto-fit, minmax(11rem, 1fr)); gap: 0.35rem 1rem; margin: 0.5rem 0; }
	dl div { display: flex; flex-direction: column; }
	dt { font-size: 0.78rem; color: var(--suave); }
	dd { margin: 0; font-weight: 600; overflow-wrap: anywhere; }
	.nota { margin: 0.75rem 0 1rem; padding: 0.6rem 0.8rem; font-size: 1.1rem; border: 2px solid var(--borda); border-radius: 0.5rem; }
	.aviso { margin-left: 0.75rem; font-size: 0.85rem; font-weight: 700; }
	.questao { margin: 1.1rem 0; padding-top: 0.75rem; border-top: 1px solid var(--borda); }
	h3 { display: flex; flex-wrap: wrap; gap: 0.25rem 1rem; align-items: baseline; justify-content: space-between; margin: 0 0 0.4rem; font-size: 1.02rem; }
	.pontos { font-size: 0.9rem; font-weight: 600; }
	.apoio { margin: 0.5rem 0; padding: 0.6rem 0.8rem; border: 1px solid var(--borda); border-radius: 0.4rem; }
	.enunciado { margin: 0.4rem 0; white-space: pre-wrap; overflow-wrap: anywhere; }
	.alternativas { padding: 0; margin: 0.4rem 0; list-style: none; }
	.alternativas li { display: flex; flex-wrap: wrap; gap: 0 0.5rem; align-items: baseline; padding: 0.25rem 0.5rem; border-radius: 0.3rem; }
	.alternativas li.correta { outline: 2px solid var(--borda); font-weight: 700; }
	.alternativas li.escolhida { background: color-mix(in srgb, var(--borda) 35%, transparent); }
	.marca-alt, .letra { font-weight: 700; }
	.rotulo { font-size: 0.78rem; font-weight: 700; padding: 0 0.4rem; border: 1px solid var(--borda); border-radius: 1rem; }
	.vf { font-size: 0.92rem; }
	.explicacao { margin: 0.5rem 0 0; font-size: 0.92rem; }
</style>
