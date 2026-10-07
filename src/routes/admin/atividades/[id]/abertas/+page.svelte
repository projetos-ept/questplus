<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { formatarData } from '#lib/data';
	import FiguraQuestao from '#lib/components/FiguraQuestao.svelte';

	let { data } = $props();
	type Item = (typeof data.questoes)[number]['itens'][number];

	let erro = $state('');
	let corrigindo = $state<{ feito: number; total: number } | null>(null);
	let nivelEscolhido = $state<Record<string, number>>({});
	let ocupado = $state<string | null>(null);
	let soAtencao = $state(false);

	const chave = (i: { tentativa_id: number; questao_id: number }) => `${i.tentativa_id}-${i.questao_id}`;
	const todas = $derived(data.questoes.flatMap((q) => q.itens));
	const pendentes = $derived(todas.filter((i) => !i.confirmado_em));
	const semSugestao = $derived(pendentes.filter((i) => i.nivel_ia === null));
	const confirmaveis = $derived(pendentes.filter((i) => i.nivel_ia !== null && i.alertas.length === 0 && !i.erro_conceitual));
	const pct = (n: number | null) => (n === null ? '—' : `${String(n).replace('.', ',')}%`);
	const NOMES = ['0 · ausente ou incorreta', '1 · ideia vaga ou erro importante', '2 · parcial', '3 · correta, pequenas lacunas', '4 · completa e correta'];

	function visiveis(itens: Item[]) {
		const lista = soAtencao ? itens.filter((i) => !i.confirmado_em && (i.alertas.length > 0 || i.erro_conceitual || i.falha)) : itens;
		// as que mais precisam de olho humano primeiro: com alerta, com falha, depois por divergência entre nível e aproximação
		const peso = (i: Item) => (i.confirmado_em ? -1 : (i.falha ? 3 : 0) + i.alertas.length + (i.erro_conceitual ? 1 : 0) + (i.nivel_ia !== null && i.aproximacao !== null ? Math.abs(i.nivel_ia / 4 - i.aproximacao / 100) : 0));
		return [...lista].sort((a, b) => peso(b) - peso(a));
	}

	async function post(url: string, corpo: unknown) {
		const r = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(corpo) });
		const j = (await r.json().catch(() => ({}))) as Record<string, unknown> & { erros?: string[] };
		return { ok: r.ok, j, msg: j.erros?.[0] ?? 'Não foi possível concluir.' };
	}

	async function corrigirTodas() {
		erro = '';
		const fila = pendentes.filter((i) => i.nivel_ia === null || i.falha);
		corrigindo = { feito: 0, total: fila.length };
		for (const i of fila) {
			const r = await post('/api/admin/abertas/corrigir', { tentativa_id: i.tentativa_id, questao_id: i.questao_id });
			if (!r.ok) erro = r.msg;
			corrigindo = { feito: corrigindo.feito + 1, total: fila.length };
		}
		corrigindo = null;
		await invalidateAll();
	}

	async function corrigirUma(i: Item) {
		erro = '';
		ocupado = chave(i);
		const r = await post('/api/admin/abertas/corrigir', { tentativa_id: i.tentativa_id, questao_id: i.questao_id });
		ocupado = null;
		if (!r.ok) erro = r.msg;
		await invalidateAll();
	}

	async function confirmar(i: Item, nivel: number) {
		erro = '';
		ocupado = chave(i);
		const r = await post('/api/admin/abertas/confirmar', { tentativa_id: i.tentativa_id, questao_id: i.questao_id, nivel });
		ocupado = null;
		if (!r.ok) { erro = r.msg; return; }
		await invalidateAll();
	}

	async function confirmarSugestoesSemAlerta() {
		if (!confirm(`Confirmar o nível sugerido pela IA nas ${confirmaveis.length} resposta(s) sem nenhum alerta? As com alerta ficam para você revisar.`)) return;
		erro = '';
		corrigindo = { feito: 0, total: confirmaveis.length };
		for (const i of confirmaveis) {
			const r = await post('/api/admin/abertas/confirmar', { tentativa_id: i.tentativa_id, questao_id: i.questao_id, nivel: i.nivel_ia });
			if (!r.ok) erro = r.msg;
			corrigindo = { feito: corrigindo.feito + 1, total: confirmaveis.length };
		}
		corrigindo = null;
		await invalidateAll();
	}
</script>

<svelte:head><title>Questões abertas · {data.atividade.titulo} · QuestPlus</title></svelte:head>

<p class="suave"><a href="/admin/atividades/{data.atividade.id}">← {data.atividade.titulo}</a> · <a href="/admin/atividades/{data.atividade.id}/relatorio">Relatório</a></p>
<h1>Correção das questões abertas</h1>

{#if data.questoes.length === 0}
	<p class="suave">Esta atividade não tem questões abertas.</p>
{:else}
	<div class="cartao resumo">
		<p>
			<strong>{pendentes.length}</strong> resposta(s) esperando confirmação · <strong>{todas.length - pendentes.length}</strong> confirmada(s)
			{#if data.emAndamento > 0}· {data.emAndamento} tentativa(s) ainda em andamento (corrija depois que finalizarem){/if}
		</p>
		<p class="suave">A IA só <strong>sugere</strong> o nível de 0 a 4 e a aproximação com a resposta de referência. A nota da questão só vale depois que você confirma (exceto resposta em branco ou curta demais, que recebe 0 sem usar IA e pode ser ajustada). A aproximação é um sinal de apoio, não a nota: textos parecidos podem dizer o contrário.</p>
		{#if !data.ia.disponivel}<p class="erro">A IA não está configurada neste ambiente: corrija manualmente escolhendo o nível de cada resposta.</p>{:else}<p class="suave">Modelo: {data.ia.modelo}</p>{/if}
		<div class="acoes">
			<button type="button" onclick={corrigirTodas} disabled={!data.ia.disponivel || !!corrigindo || (semSugestao.length === 0 && !pendentes.some((i) => i.falha))}>
				{corrigindo ? `Processando ${corrigindo.feito} de ${corrigindo.total}…` : `Corrigir ${semSugestao.length} pendente(s) com IA`}
			</button>
			<button type="button" class="sec" onclick={confirmarSugestoesSemAlerta} disabled={!!corrigindo || confirmaveis.length === 0}>Confirmar sugestões sem alerta ({confirmaveis.length})</button>
			<label class="check"><input type="checkbox" bind:checked={soAtencao} /> Mostrar só as que precisam de atenção</label>
		</div>
	</div>

	{#if erro}<p class="erro" role="alert">{erro}</p>{/if}

	{#each data.questoes as q, n (q.id)}
		{@const itens = visiveis(q.itens)}
		{@const conf = q.itens.filter((i) => i.confirmado_em)}
		<section class="questao">
			<h2>Questão aberta {n + 1} <span class="suave">· {q.pontos} ponto(s)</span></h2>
			<p class="enunciado">{q.enunciado}</p>
			<FiguraQuestao imagem={q.imagem} />
			{#if conf.length > 0}
				{@const dist = [0, 1, 2, 3, 4].map((k) => conf.filter((i) => i.nivel_final === k).length)}
				{@const aprox = q.itens.filter((i) => i.aproximacao !== null)}
				<p class="suave">
					Níveis confirmados: {dist.map((v, k) => `${k}: ${v}`).join(' · ')}
					{#if aprox.length}· aproximação média {pct(Math.round((aprox.reduce((s, i) => s + (i.aproximacao ?? 0), 0) / aprox.length) * 10) / 10)}{/if}
				</p>
			{/if}
			{#if q.itens.length === 0}<p class="suave">Nenhuma resposta finalizada ainda.</p>{/if}

			{#each itens as i (chave(i))}
				{@const k = chave(i)}
				<article class="resposta" class:confirmada={!!i.confirmado_em}>
					<header>
						<strong>{i.nome}</strong> <span class="suave">{i.turma} · {i.email}</span>
						{#if i.confirmado_em}<span class="selo ok">Confirmada · nível {i.nivel_final}{i.confirmado_por === 'triagem' ? ' (triagem)' : ''}</span>{:else}<span class="selo">Aguardando confirmação</span>{/if}
					</header>
					<blockquote>{i.texto}</blockquote>

					{#if i.triagem}<p class="suave">Triagem automática: {i.triagem} Nota 0 sem usar IA.</p>{/if}
					{#if i.falha}<p class="erro">Falha da IA: {i.falha} Corrija à mão ou tente de novo.</p>{/if}
					{#if i.nivel_ia !== null && !i.triagem}
						<div class="sugestao">
							<p>Sugestão da IA: <strong>nível {i.nivel_ia}</strong> · aproximação com a referência: <strong>{pct(i.aproximacao)}</strong></p>
							{#if i.justificativa}<p class="suave">{i.justificativa}</p>{/if}
							{#if i.conceitos}
								<p class="suave">
									{#if i.conceitos.presentes.length}Presentes: {i.conceitos.presentes.join(', ')}.{/if}
									{#if i.conceitos.faltantes.length}Faltando: {i.conceitos.faltantes.join(', ')}.{/if}
								</p>
							{/if}
						</div>
					{/if}
					{#each i.alertas as a}<p class="alerta">⚠ {a.texto}</p>{/each}

					<div class="acoes">
						<label>Nível
							<select value={nivelEscolhido[k] ?? i.nivel_final ?? i.nivel_ia ?? ''} onchange={(e) => (nivelEscolhido[k] = Number(e.currentTarget.value))} disabled={ocupado === k}>
								<option value="" disabled>Escolha…</option>
								{#each NOMES as nome, v}<option value={v}>{nome}</option>{/each}
							</select>
						</label>
						<button type="button" onclick={() => confirmar(i, nivelEscolhido[k] ?? i.nivel_final ?? i.nivel_ia ?? -1)} disabled={ocupado === k || (nivelEscolhido[k] ?? i.nivel_final ?? i.nivel_ia) === undefined || (nivelEscolhido[k] ?? i.nivel_final ?? i.nivel_ia) === null}>
							{i.confirmado_em ? 'Atualizar nível' : 'Confirmar'}
						</button>
						{#if !i.confirmado_em && data.ia.disponivel}<button type="button" class="sec" onclick={() => corrigirUma(i)} disabled={ocupado === k}>{i.nivel_ia === null ? 'Corrigir com IA' : 'Refazer com IA'}</button>{/if}
					</div>
					{#if i.confirmado_em}<p class="suave">Pontos: {i.pontos_final ?? 0} de {q.pontos} · confirmada em {formatarData(i.confirmado_em)}</p>{/if}
				</article>
			{/each}
		</section>
	{/each}
{/if}

<style>
	.resumo .acoes { display: flex; flex-wrap: wrap; gap: 0.75rem; align-items: center; margin-top: 0.5rem; }
	.acoes { display: flex; flex-wrap: wrap; gap: 0.75rem; align-items: end; }
	.acoes button, .acoes select { margin: 0; }
	.check { display: flex; gap: 0.5rem; align-items: center; font-weight: 400; }
	.questao { margin-top: 2rem; }
	.enunciado { padding: 0.5rem 0.75rem; background: var(--fundo); border-radius: 0.4rem; }
	.resposta { margin: 1rem 0; padding: 0.75rem 1rem; border: 1px solid var(--borda); border-radius: 0.5rem; }
	.resposta.confirmada { opacity: 0.85; }
	blockquote { margin: 0.5rem 0; padding: 0.5rem 0.75rem; white-space: pre-wrap; overflow-wrap: anywhere; border-left: 3px solid var(--borda); background: var(--fundo); }
	.sugestao p { margin: 0.2rem 0; }
	.alerta { margin: 0.3rem 0; font-weight: 600; color: var(--erro); }
	.selo { margin-left: 0.5rem; padding: 0.1rem 0.5rem; font-size: 0.8rem; border: 1px solid var(--borda); border-radius: 1rem; }
	.selo.ok { border-color: var(--primaria); }
</style>
