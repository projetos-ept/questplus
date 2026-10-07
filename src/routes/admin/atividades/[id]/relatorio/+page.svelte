<script lang="ts">
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';
	import { formatarData } from '#lib/data';
	import { formatarTempo } from '#lib/relatorio';

	let { data } = $props();
	let emitido = $state('');
	onMount(() => (emitido = new Date().toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })));

	const MAX_COLUNAS = 25; // acima disso a grade de pontos por questão não cabe na página
	const r = $derived(data.resumo);
	const pct = (n: number | null) => (n === null ? '—' : `${String(n).replace('.', ',')}%`);
	const pts = (n: number | null) => (n === null ? '—' : String(Math.round(n * 100) / 100).replace('.', ','));
	const maiorFaixa = $derived(Math.max(1, ...r.distribuicao.map((d) => d.alunos)));
	const resumo = (t: string) => (t.length > 90 ? `${t.slice(0, 90)}…` : t);
	const turmaAtual = $derived(data.turmas.find((t) => t.id === data.turmaId)?.nome);
	const consulta = $derived(data.turmaId ? `turma=${data.turmaId}` : '');
	const grade = $derived(data.questoes.length > 0 && data.questoes.length <= MAX_COLUNAS);

	function filtrar(e: Event) {
		const v = (e.currentTarget as HTMLSelectElement).value;
		goto(v ? `?turma=${v}` : '?', { reset: false });
	}
</script>

<svelte:head><title>Relatório · {data.atividade.titulo}</title></svelte:head>

<div class="nao-imprimir barra">
	<a href="/admin/atividades">← Atividades</a>
	<label class="filtro">Turma
		<select aria-label="Filtrar por turma" onchange={filtrar} value={data.turmaId ?? ''}>
			<option value="">Todas</option>
			{#each data.turmas as t}<option value={t.id}>{t.nome}</option>{/each}
		</select>
	</label>
	<div class="botoes">
		<button type="button" onclick={() => window.print()}>Imprimir</button>
		<a class="botao" href="/api/admin/atividades/{data.atividade.id}/respostas?formato=json{consulta ? `&${consulta}` : ''}" download>Exportar JSON</a>
		<a class="botao" href="/api/admin/atividades/{data.atividade.id}/respostas?formato=csv{consulta ? `&${consulta}` : ''}" download>Exportar CSV</a>
		<a class="botao" href="/admin/atividades/{data.atividade.id}/relatorios{consulta ? `?${consulta}` : ''}">Relatórios individuais</a>
	</div>
</div>

<header class="titulo">
	<p class="suave marca">QuestPlus · Relatório da atividade</p>
	<h1>{data.atividade.titulo}</h1>
	{#if data.atividade.componente}<p class="componente">{data.atividade.componente}</p>{/if}
	<p class="suave">
		{data.atividade.modo === 'prova' ? 'Prova' : 'Treino'} · código <code>{data.atividade.codigo}</code>
		{#if turmaAtual} · turma {turmaAtual}{/if}
		{#if data.atividade.fecha_em} · prazo {formatarData(data.atividade.fecha_em)}{/if}
		{#if emitido} · emitido em {emitido}{/if}
	</p>
</header>

{#if data.abertasPendentes > 0}
	<p class="cartao aviso-abertas" role="status"><strong>{data.abertasPendentes} resposta(s) de questões abertas aguardam sua correção</strong>; as notas abaixo ainda são parciais. <a href="/admin/atividades/{data.atividade.id}/abertas">Corrigir agora</a></p>
{/if}

{#if r.alunos === 0}
	<p class="suave">Nenhum aluno finalizou esta atividade{turmaAtual ? ` nesta turma` : ''} ainda.{r.emAndamento ? ` ${r.emAndamento} tentativa(s) em andamento.` : ''}</p>
{:else}
	<section aria-label="Resumo" class="cards">
		<div class="cartao"><span class="rot">Alunos</span><strong>{r.alunos}</strong><span class="suave">{r.tentativas} tentativa(s) válida(s)</span></div>
		<div class="cartao"><span class="rot">Média</span><strong>{pct(r.mediaPercentual)}</strong><span class="suave">{pts(r.mediaPontos)} pontos</span></div>
		<div class="cartao"><span class="rot">Mediana</span><strong>{pct(r.medianaPercentual)}</strong></div>
		<div class="cartao"><span class="rot">Maior · menor</span><strong>{pct(r.maiorPercentual)} · {pct(r.menorPercentual)}</strong></div>
	</section>
	<p class="suave nota">
		Vale a <strong>maior nota</strong> de cada aluno (identificado pelo e-mail). Tentativas anuladas ({r.anuladas}) e em andamento ({r.emAndamento}) não contam.
	</p>

	{#if data.possiveisDuplicados.length}
		<div class="cartao atencao" role="status">
			<strong>Atenção: mesmo nome com e-mails diferentes.</strong> O aluno é identificado pelo e-mail; quem troca de e-mail aparece como outra pessoa e ganha tentativas novas. Confira:
			<ul>
				{#each data.possiveisDuplicados as d}<li><strong>{d.nome}</strong> — {d.emails.join(', ')}{d.turmas.length > 1 ? ` (turmas: ${d.turmas.join(', ')})` : ''}</li>{/each}
			</ul>
		</div>
	{/if}

	<h2>Distribuição das notas</h2>
	<table class="dist" aria-label="Distribuição das notas">
		<tbody>
			{#each r.distribuicao as d}
				<tr>
					<th scope="row">{d.rotulo}</th>
					<td class="celula-barra"><div class="barra-celula"><div class="preench" style="width: {(d.alunos / maiorFaixa) * 100}%"></div></div></td>
					<td class="num">{d.alunos} aluno(s)</td>
				</tr>
			{/each}
		</tbody>
	</table>

	<h2>Aproveitamento por questão</h2>
	<div class="rolagem">
		<table>
			<thead><tr><th>#</th><th>Questão</th><th>Formato</th><th>Em branco</th><th>Aproveitamento</th></tr></thead>
			<tbody>
				{#each data.questoes as q, i (q.id)}
					<tr>
						<td>{i + 1}</td>
						<td>{resumo(q.enunciado)}</td>
						<td>{q.tipo === 'vf' ? 'VF' : q.tipo === 'aberta' ? 'Aberta' : 'MC'}</td>
						<td>{q.emBranco} de {q.alunos}</td>
						<td class="aprov"><div class="barra-celula"><div class="preench" style="width: {q.aproveitamento}%"></div></div><span class="num">{pct(q.aproveitamento)}</span></td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
	<p class="suave nota">Baseado nas questões atuais da atividade, na tentativa de maior nota de cada aluno. Aproveitamento = pontos obtidos ÷ pontos possíveis.</p>

	<h2>Alunos</h2>
	<div class="rolagem">
		<table class="alunos">
			<thead>
				<tr>
					<th>Aluno</th><th>Turma</th><th>E-mail</th><th>Tent.</th><th>Maior nota</th><th>%</th><th>Tempo</th>
					{#if grade}{#each data.questoes as _, i}<th class="q" title={data.questoes[i].enunciado}>Q{i + 1}</th>{/each}{/if}
					<th class="nao-imprimir"></th>
				</tr>
			</thead>
			<tbody>
				{#each data.alunos as a (a.tentativaId)}
					<tr>
						<td>{a.nome}</td><td>{a.turma}</td><td class="email">{a.email}</td><td class="num">{a.tentativas}</td>
						<td class="num">{pts(a.nota)} / {pts(a.pontosMax)}</td><td class="num">{pct(a.percentual)}</td><td class="num">{formatarTempo(a.tempoSegundos)}</td>
						{#if grade}{#each a.pontosPorQuestao as p, i}<td class="num q" title={p === null ? 'Em branco' : `${pts(p)} de ${pts(data.questoes[i].pontos)}`}>{p === null ? '–' : pts(p)}</td>{/each}{/if}
						<td class="nao-imprimir"><a href="/admin/tentativas/{a.tentativaId}/relatorio">Detalhe</a></td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
	{#if grade}<p class="suave nota">Colunas Q1…Q{data.questoes.length}: pontos obtidos em cada questão (– = em branco).</p>{/if}
{/if}

<style>
	.aviso-abertas { border-color: var(--erro); }
	.barra { display: flex; flex-wrap: wrap; gap: 0.5rem 1.25rem; align-items: center; justify-content: space-between; margin-bottom: 1rem; padding: 0.6rem 0.8rem; background: var(--superficie); border: 1px solid var(--borda); border-radius: 0.5rem; }
	.filtro { display: flex; gap: 0.4rem; align-items: center; margin: 0; font-weight: 600; }
	.filtro select { width: auto; margin: 0; }
	.botoes { display: flex; flex-wrap: wrap; gap: 0.5rem; }
	.botoes button, .botao { margin: 0; padding: 0.45rem 0.9rem; font-size: 0.9rem; font-weight: 600; color: var(--texto); text-decoration: none; background: transparent; border: 1px solid var(--borda); border-radius: 0.4rem; cursor: pointer; }
	.botoes button { color: var(--sobre-destaque); background: var(--destaque); border-color: var(--destaque); }
	.marca { margin: 0; font-size: 0.85rem; }
	h1 { margin: 0.1rem 0 0.25rem; }
	h2 { margin: 1.5rem 0 0.5rem; font-size: 1.1rem; }
	.cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(10rem, 1fr)); gap: 0.75rem; margin-top: 1rem; }
	.cards .cartao { display: flex; flex-direction: column; gap: 0.15rem; }
	.cards strong { font-size: 1.5rem; }
	.rot { font-size: 0.8rem; font-weight: 600; color: var(--suave); }
	.nota { font-size: 0.85rem; }
	.atencao { margin-top: 1rem; border-color: var(--erro); }
	.atencao ul { margin: 0.4rem 0 0; padding-left: 1.2rem; }
	.rolagem { overflow-x: auto; }
	.dist { width: auto; min-width: 22rem; }
	.dist th { white-space: nowrap; }
	.barra-celula { min-width: 8rem; height: 0.7rem; background: var(--borda); border-radius: 1rem; overflow: hidden; }
	.preench { height: 100%; background: var(--destaque); }
	.aprov { display: flex; gap: 0.6rem; align-items: center; }
	.aprov .barra-celula { flex: 1; }
	.num { white-space: nowrap; font-variant-numeric: tabular-nums; }
	.alunos { font-size: 0.9rem; }
	.alunos .email { min-width: 12rem; font-size: 0.82rem; overflow-wrap: normal; word-break: normal; }
	.celula-barra { min-width: 10rem; }
	.q { text-align: center; min-width: 2rem; padding-inline: 0.3rem; }
</style>
