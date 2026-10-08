<script lang="ts">
	import { goto, invalidateAll } from '$app/navigation';
	import { onMount, untrack } from 'svelte';
	import { formatarData } from '#lib/data';
	import LogoCabecalho from '#lib/components/LogoCabecalho.svelte';
	import { formatarTempo, formatarUmaCasa, notaComPeso, validarPeso } from '#lib/relatorio';

	let { data } = $props();
	let emitido = $state('');
	let modalImpressao: HTMLDialogElement;
	let voltar = $state('/admin/relatorios');
	onMount(() => {
		emitido = new Date().toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
		try {
			const q = sessionStorage.getItem('qp_rel_consulta');
			if (q) voltar = `/admin/relatorios?${q}`;
		} catch {}
	});

	// peso da atividade (0 a 10, uma casa): vazio = relatórios sem peso. Nota = pontos obtidos ÷ pontos possíveis × peso.
	let pesoTxt = $state(untrack(() => (data.atividade.peso === null ? '' : formatarUmaCasa(data.atividade.peso))));
	let pesoErro = $state('');
	let pesoMsg = $state('');
	let salvandoPeso = $state(false);
	const pesoAtual = $derived(data.atividade.peso);
	const exemploPeso = $derived.by(() => {
		const v = validarPeso(pesoTxt);
		const a = data.alunos[0];
		return v.ok && v.valor !== null && a ? { peso: v.valor, nota: notaComPeso(a.nota, a.pontosMax, v.valor), score: a } : null;
	});
	async function salvarPeso(e: SubmitEvent) {
		e.preventDefault();
		pesoErro = pesoMsg = '';
		const v = validarPeso(pesoTxt);
		if (!v.ok) return void (pesoErro = v.erro);
		salvandoPeso = true;
		try {
			const r = await fetch(`/api/admin/atividades/${data.atividade.id}/peso`, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ peso: v.valor }) });
			const j = (await r.json().catch(() => ({}))) as { erros?: string[] };
			if (!r.ok) pesoErro = j.erros?.[0] ?? 'Não foi possível salvar o peso.';
			else {
				pesoTxt = v.valor === null ? '' : formatarUmaCasa(v.valor);
				await invalidateAll();
				pesoMsg = v.valor === null ? 'Peso removido: os relatórios voltam a mostrar só a pontuação.' : `Peso ${formatarUmaCasa(v.valor)} salvo.`;
			}
		} catch {
			pesoErro = 'Falha de conexão. Tente de novo.';
		} finally {
			salvandoPeso = false;
		}
	}

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
	<a href={voltar}>← Relatórios</a>
	<label class="filtro">Turma
		<select aria-label="Filtrar por turma" onchange={filtrar} value={data.turmaId ?? ''}>
			<option value="">Todas</option>
			{#each data.turmas as t}<option value={t.id}>{t.nome}</option>{/each}
		</select>
	</label>
	<div class="botoes">
		<button type="button" onclick={() => modalImpressao.showModal()}>Imprimir</button>
		<a class="botao" href="/api/admin/atividades/{data.atividade.id}/respostas?formato=json{consulta ? `&${consulta}` : ''}" download>Exportar JSON</a>
		<a class="botao" href="/api/admin/atividades/{data.atividade.id}/respostas?formato=csv{consulta ? `&${consulta}` : ''}" download>Exportar CSV</a>
		<a class="botao" href="/admin/relatorios/{data.atividade.id}/individuais{consulta ? `?${consulta}` : ''}">Relatórios individuais</a>
	</div>
</div>

<header class="titulo">
	<div class="cab-topo">
		{#if data.atividade.logo_chave}<LogoCabecalho chave={data.atividade.logo_chave} />{/if}
		<div>
		<p class="suave marca">QuestPlus · Relatório da atividade</p>
		<h1>{data.atividade.titulo}</h1>
		{#if data.atividade.componente}<p class="componente">{data.atividade.componente}</p>{/if}
		{#if data.professor}<p class="professor">Professor(a): {data.professor}</p>{/if}
		<p class="suave">
			{data.atividade.modo === 'prova' ? 'Prova' : 'Treino'} · código <code>{data.atividade.codigo}</code>
			{#if pesoAtual !== null} · peso da atividade {formatarUmaCasa(pesoAtual)}{/if}
			{#if turmaAtual} · turma {turmaAtual}{/if}
			{#if data.atividade.fecha_em} · prazo {formatarData(data.atividade.fecha_em)}{/if}
			{#if emitido} · emitido em {emitido}{/if}
		</p>
		</div>
	</div>
</header>

<dialog bind:this={modalImpressao} class="nao-imprimir" aria-labelledby="t-imprimir">
	<div class="corpo-modal">
		<h2 id="t-imprimir">Imprimir relatório</h2>
		<p class="suave">Escolha o formato da impressão.</p>
		<div class="opcoes">
			<button type="button" class="opc" onclick={() => goto(`/admin/relatorios/${data.atividade.id}/resumo?imprimir=1${data.turmaId ? `&turma=${data.turmaId}` : ''}`)}>
				<strong>Resumido, 1 página</strong>
				<span>Cabeçalho da atividade e lista: estudante, e-mail, data e hora e nota final.</span>
			</button>
			<button type="button" class="opc" onclick={() => { modalImpressao.close(); setTimeout(() => window.print(), 100); }}>
				<strong>Completo</strong>
				<span>Resumo, distribuição, aproveitamento por questão e pontos de cada questão (como antes).</span>
			</button>
		</div>
		<div class="acoes-modal"><button type="button" class="sec" onclick={() => modalImpressao.close()}>Cancelar</button></div>
	</div>
</dialog>

<form class="cartao peso nao-imprimir" onsubmit={salvarPeso} aria-labelledby="t-peso">
	<h2 id="t-peso">Peso da atividade</h2>
	<div class="linha-peso">
		<label for="peso">Peso (0 a 10, uma casa decimal)</label>
		<input id="peso" inputmode="decimal" autocomplete="off" placeholder="Sem peso" bind:value={pesoTxt} aria-describedby="ajuda-peso" aria-invalid={!!pesoErro} />
		<button type="submit" disabled={salvandoPeso}>{salvandoPeso ? 'Salvando…' : 'Salvar peso'}</button>
	</div>
	<p id="ajuda-peso" class="suave">
		Vazio: os relatórios ficam como estão. Com peso, a nota é <strong>pontos obtidos ÷ pontos possíveis × peso</strong>
		{#if exemploPeso}· por exemplo, {pts(exemploPeso.score.nota)} de {pts(exemploPeso.score.pontosMax)} pontos com peso {formatarUmaCasa(exemploPeso.peso)} = nota <strong>{formatarUmaCasa(exemploPeso.nota ?? 0)}</strong>{/if}.
	</p>
	{#if pesoErro}<p class="erro" role="alert">{pesoErro}</p>{/if}
	{#if pesoMsg}<p class="ok-msg" role="status">{pesoMsg}</p>{/if}
</form>

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
					<th>Aluno</th><th>Turma</th><th>E-mail</th><th>Tent.</th><th>Maior nota</th><th>%</th>{#if pesoAtual !== null}<th title="Nota com o peso {formatarUmaCasa(pesoAtual)}">Nota (peso {formatarUmaCasa(pesoAtual)})</th>{/if}<th>Tempo</th>
					{#if grade}{#each data.questoes as _, i}<th class="q" title={data.questoes[i].enunciado}>Q{i + 1}</th>{/each}{/if}
					<th class="nao-imprimir"></th>
				</tr>
			</thead>
			<tbody>
				{#each data.alunos as a (a.tentativaId)}
					<tr>
						<td>{a.nome}</td><td>{a.turma}</td><td class="email">{a.email}</td><td class="num">{a.tentativas}</td>
						<td class="num">{pts(a.nota)} / {pts(a.pontosMax)}</td><td class="num">{pct(a.percentual)}</td>{#if pesoAtual !== null}<td class="num nota-peso">{a.notaPeso === null ? '—' : formatarUmaCasa(a.notaPeso)}</td>{/if}<td class="num">{formatarTempo(a.tempoSegundos)}</td>
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
	dialog { width: min(30rem, calc(100vw - 2rem)); padding: 0; color: var(--texto); background: var(--superficie); border: 1px solid var(--borda); border-radius: var(--raio); box-shadow: var(--sombra); }
	dialog::backdrop { background: color-mix(in srgb, var(--texto) 55%, transparent); }
	.corpo-modal { padding: 1.25rem; }
	.corpo-modal h2 { margin: 0 0 0.25rem; font-size: var(--escala-h3); }
	.opcoes { display: grid; gap: 10px; }
	.opc { display: flex; flex-direction: column; gap: 0.15rem; align-items: flex-start; margin: 0; padding: 12px 14px; color: var(--texto); text-align: left; background: var(--superficie); border: 1px solid var(--borda); border-radius: 14px; box-shadow: none; }
	.opc strong { color: var(--primaria); }
	.opc span { font-size: var(--escala-sm); font-weight: 400; color: var(--texto-secundario); }
	.opc:hover:not(:disabled) { border-color: var(--primaria); }
	.acoes-modal { display: flex; justify-content: flex-end; margin-top: 14px; }
	.acoes-modal button { margin: 0; }
	.peso { margin: 1rem 0; }
	.peso h2 { margin: 0 0 0.35rem; font-size: var(--escala-h3); }
	.linha-peso { display: flex; flex-wrap: wrap; gap: 0.5rem 0.75rem; align-items: end; }
	.linha-peso label { margin: 0; }
	.linha-peso input { width: 8rem; margin: 0; }
	.linha-peso button { margin: 0; }
	.peso p { margin: 0.5rem 0 0; }
	.ok-msg { color: var(--sucesso); font-weight: var(--peso-acao); }
	.nota-peso { font-weight: var(--peso-titulo); color: var(--secundaria); }
	.aviso-abertas { border-color: var(--erro); }
	.barra { display: flex; flex-wrap: wrap; gap: 0.5rem 1.25rem; align-items: center; justify-content: space-between; margin-bottom: 1rem; padding: 0.6rem 0.8rem; background: var(--superficie); border: 1px solid var(--borda); border-radius: 0.5rem; }
	.filtro { display: flex; gap: 0.4rem; align-items: center; margin: 0; font-weight: 600; }
	.filtro select { width: auto; margin: 0; }
	.botoes { display: flex; flex-wrap: wrap; gap: 0.5rem; }
	.botoes button, .botao { margin: 0; padding: 0.45rem 0.9rem; font-size: 0.9rem; font-weight: 600; color: var(--texto); text-decoration: none; background: transparent; border: 1px solid var(--borda); border-radius: 0.4rem; cursor: pointer; }
	.botoes button { color: var(--sobre-primaria); background: var(--primaria); border-color: var(--primaria); }
	.marca { margin: 0; font-size: 0.85rem; }
	h1 { margin: 0.1rem 0 0.25rem; }
	h2 { margin: 1.5rem 0 0.5rem; font-size: 1.1rem; }
	.cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(10rem, 1fr)); gap: 0.75rem; margin-top: 1rem; }
	.cards .cartao { display: flex; flex-direction: column; gap: 0.15rem; }
	.cards strong { font-size: 1.5rem; }
	.rot { font-size: 0.8rem; font-weight: 600; color: var(--texto-secundario); }
	.nota { font-size: 0.85rem; }
	.atencao { margin-top: 1rem; border-color: var(--erro); }
	.atencao ul { margin: 0.4rem 0 0; padding-left: 1.2rem; }
	.rolagem { overflow-x: auto; }
	.dist { width: auto; min-width: 22rem; }
	.dist th { white-space: nowrap; }
	.barra-celula { min-width: 8rem; height: 0.7rem; background: var(--borda); border-radius: 1rem; overflow: hidden; }
	.preench { height: 100%; background: var(--primaria); }
	.aprov { display: flex; gap: 0.6rem; align-items: center; }
	.aprov .barra-celula { flex: 1; }
	.num { white-space: nowrap; font-variant-numeric: tabular-nums; }
	.alunos { font-size: 0.9rem; }
	.alunos .email { min-width: 12rem; font-size: 0.82rem; overflow-wrap: normal; word-break: normal; }
	.celula-barra { min-width: 10rem; }
	.q { text-align: center; min-width: 2rem; padding-inline: 0.3rem; }
</style>
