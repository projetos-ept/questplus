<script lang="ts">
	import { onMount } from 'svelte';
	import { formatarData } from '#lib/data';
	import { formatarUmaCasa } from '#lib/relatorio';

	let { data } = $props();
	let emitido = $state('');

	const a = $derived(data.atividade);
	const r = $derived(data.resumo);
	const turmaFiltrada = $derived(data.turmas.find((t) => t.id === data.turmaId)?.nome);
	const turmasTexto = $derived(turmaFiltrada ?? (data.turmas.map((t) => t.nome).join(', ') || '—'));
	const pontosTotal = $derived(data.questoes.reduce((s, q) => s + q.pontos, 0));
	// só quem finalizou entra (o relatório da atividade já considera apenas tentativas válidas), em ordem alfabética
	const alunos = $derived(data.alunos.toSorted((x, y) => x.nome.localeCompare(y.nome, 'pt-BR')));
	// a letra diminui sozinha para caber em uma página A4; acima disso continua na seguinte, repetindo o cabeçalho da tabela
	const densidade = $derived(alunos.length > 32 ? 'ultra' : alunos.length > 20 ? 'compacto' : 'normal');
	const pts = (n: number) => String(Math.round(n * 100) / 100).replace('.', ',');
	const notaFinal = (x: (typeof alunos)[number]) => (x.notaPeso !== null && a.peso !== null ? formatarUmaCasa(x.notaPeso) : `${pts(x.nota)} / ${pts(x.pontosMax)}`);

	onMount(() => {
		emitido = new Date().toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
		if (new URLSearchParams(location.search).get('imprimir') === '1') setTimeout(() => window.print(), 300);
	});
</script>

<svelte:head><title>Relatório resumido · {a.titulo}</title></svelte:head>

<div class="nao-imprimir barra">
	<a href="/admin/atividades/{a.id}/relatorio{data.turmaId ? `?turma=${data.turmaId}` : ''}">← Relatório da atividade</a>
	<button type="button" onclick={() => window.print()}>Imprimir</button>
</div>

<article class="folha {densidade}">
	<header class="cab">
		<div>
			<p class="marca">QuestPlus · Relatório resumido</p>
			<h1>{a.titulo}</h1>
			{#if a.componente}<p class="comp">{a.componente}</p>{/if}
			{#if data.professor}<p class="prof">Professor(a): {data.professor}</p>{/if}
		</div>
		<div class="sel">{r.alunos} aluno(s)<br />Média {String(r.mediaPercentual).replace('.', ',')}%</div>
	</header>
	<dl class="dados">
		<div><dt>Turma(s)</dt><dd>{turmasTexto}</dd></div>
		<div><dt>Modo</dt><dd>{a.modo === 'prova' ? 'Prova' : 'Treino'}</dd></div>
		<div><dt>Código</dt><dd>{a.codigo}</dd></div>
		<div><dt>Prazo</dt><dd>{a.fecha_em ? formatarData(a.fecha_em) : 'sem prazo'}</dd></div>
		<div><dt>Questões</dt><dd>{data.questoes.length}</dd></div>
		<div><dt>Pontuação total</dt><dd>{pts(pontosTotal)} pontos</dd></div>
		<div><dt>Peso da atividade</dt><dd>{a.peso !== null ? formatarUmaCasa(a.peso) : 'sem peso'}</dd></div>
		<div><dt>Critério</dt><dd>maior nota de cada aluno</dd></div>
	</dl>
	<div class="resumo">
		<div>Alunos<br /><b>{r.alunos}</b></div>
		<div>Média<br /><b>{String(r.mediaPercentual).replace('.', ',')}%</b></div>
	</div>
	{#if alunos.length === 0}
		<p class="vazio">Nenhum aluno finalizou esta atividade{turmaFiltrada ? ' nesta turma' : ''} ainda.</p>
	{:else}
		<table>
			<caption class="so-leitor">Lista de estudantes com data, hora e nota final</caption>
			<thead>
				<tr><th scope="col">#</th><th scope="col">Estudante</th><th scope="col">E-mail</th><th scope="col" class="c">Data e hora</th><th scope="col" class="c">{a.peso !== null ? `Nota final (peso ${formatarUmaCasa(a.peso)})` : 'Nota final (pontos)'}</th></tr>
			</thead>
			<tbody>
				{#each alunos as x, i (x.tentativaId)}
					<tr><td class="n">{i + 1}</td><td>{x.nome}</td><td class="mail">{x.email}</td><td class="c">{x.finalizadaEm ? formatarData(x.finalizadaEm) : '—'}</td><td class="nota">{notaFinal(x)}</td></tr>
				{/each}
			</tbody>
		</table>
	{/if}
	<footer class="rodape">
		<span>Só alunos que finalizaram. {a.peso !== null ? 'Nota final = pontos obtidos ÷ pontos possíveis × peso (uma casa decimal).' : 'Nota final = pontos obtidos / pontos possíveis.'}</span>
		<span>{emitido ? `Emitido em ${emitido}` : ''}</span>
	</footer>
</article>

<style>
	.barra { display: flex; flex-wrap: wrap; gap: 0.5rem 1rem; align-items: center; justify-content: space-between; margin-bottom: 1rem; }
	.barra button { margin: 0; }
	.folha { max-width: 210mm; margin: 0 auto; padding: 12mm 13mm; color: #000; background: #fff; border: 1px solid var(--borda); box-shadow: var(--sombra); }
	.cab { display: flex; justify-content: space-between; gap: 12px; padding-bottom: 6px; margin-bottom: 8px; border-bottom: 2px solid #000; }
	.marca { margin: 0; font-size: 8.5pt; color: #444; }
	h1 { margin: 1px 0 0; font-size: 15pt; letter-spacing: var(--tracking); line-height: 1.2; }
	.comp { margin: 1px 0 0; font-size: 10pt; font-weight: 700; color: #222; }
	.prof { margin: 1px 0 0; font-size: 9pt; color: #222; }
	.sel { align-self: flex-start; font-size: 8.5pt; color: #444; text-align: right; white-space: nowrap; }
	.dados { display: grid; grid-template-columns: repeat(4, 1fr); gap: 3px 12px; margin: 0 0 8px; font-size: 8.5pt; }
	.dados div { padding-left: 6px; border-left: 2px solid #999; }
	.dados dt { font-size: 7.5pt; color: #555; }
	.dados dd { margin: 0; font-weight: 700; overflow-wrap: anywhere; }
	.resumo { display: flex; margin: 0 0 8px; font-size: 8.5pt; border: 1px solid #000; }
	.resumo div { flex: 1; padding: 3px 8px; border-right: 1px solid #000; }
	.resumo div:last-child { border-right: 0; }
	.resumo b { font-size: 11pt; }
	table { width: 100%; font-size: 9pt; border-collapse: collapse; background: #fff; }
	thead { display: table-header-group; }
	tr { break-inside: avoid; }
	th { padding: 3px 6px; font-size: 8pt; color: #000; text-align: left; background: #e9e9e9; border: 1px solid #000; }
	td { padding: 2.5px 6px; vertical-align: middle; border: 1px solid #777; }
	td.n { width: 8mm; color: #444; text-align: right; }
	.c { width: 34mm; text-align: center; white-space: nowrap; }
	td.mail { font-size: 8pt; overflow-wrap: anywhere; }
	td.nota { width: 26mm; font-size: 10.5pt; font-weight: 800; text-align: center; background: #eef2fb; }
	.vazio { margin: 1rem 0; text-align: center; }
	.rodape { display: flex; justify-content: space-between; gap: 10px; margin-top: 6px; font-size: 7.5pt; color: #444; }
	.so-leitor { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
	.compacto table { font-size: 8.5pt; }
	.compacto td { padding: 1.4px 5px; line-height: 1.25; }
	.compacto td.nota { font-size: 9.5pt; }
	.compacto h1 { font-size: 13pt; }
	.compacto .dados, .compacto .resumo { margin-bottom: 6px; }
	.ultra table { font-size: 7.5pt; }
	.ultra td { padding: 0.5px 4px; line-height: 1.15; }
	.ultra th { padding: 2px 4px; }
	.ultra td.nota { font-size: 8.5pt; }
	.ultra td.mail { font-size: 7pt; }
	.ultra h1 { font-size: 12pt; }
	.ultra .dados { margin-bottom: 5px; font-size: 8pt; }
	.ultra .resumo { margin-bottom: 5px; }
	@media (max-width: 720px) {
		.dados { grid-template-columns: repeat(2, 1fr); }
		.folha { padding: 1rem; overflow-x: auto; }
		.c { width: auto; }
	}
	@media print {
		.folha { max-width: none; padding: 0; margin: 0; border: 0; }
		td.nota { background: #fff; border: 1.5px solid #000; }
		th { background: #fff; border-bottom: 2px solid #000; }
	}
</style>
