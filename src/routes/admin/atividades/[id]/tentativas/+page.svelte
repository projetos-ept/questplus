<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { formatarData } from '#lib/data';
	import { expirou } from '#lib/atividade';

	let { data } = $props();
	let erro = $state('');

	/** Na Prova vale a maior nota de cada aluno (pelo e-mail), entre as tentativas finalizadas e não anuladas. */
	const melhores = $derived.by(() => {
		const por = new Map<string, { id: number; nota: number; n: number }>();
		for (const t of data.tentativas) {
			if (t.anulada || t.status !== 'finalizada') continue;
			const k = t.email.toLowerCase();
			const atual = por.get(k);
			const nota = t.nota ?? 0;
			por.set(k, { id: !atual || nota > atual.nota ? t.id : atual.id, nota: Math.max(nota, atual?.nota ?? 0), n: (atual?.n ?? 0) + 1 });
		}
		return por;
	});
	const ehMelhor = (t: (typeof data.tentativas)[number]) => {
		const m = melhores.get(t.email.toLowerCase());
		return data.atividade.modo === 'prova' && !!m && m.n > 1 && m.id === t.id;
	};

	const situacao = (t: (typeof data.tentativas)[number]) => (t.anulada ? 'Anulada' : t.status === 'finalizada' ? 'Finalizada' : 'Em andamento');
	const emAndamento = (t: (typeof data.tentativas)[number]) =>
		!t.anulada && t.status === 'andamento' && !expirou(t.prazo_em, t.acrescimo_segundos);

	async function acao(url: string, corpo?: unknown) {
		erro = '';
		const r = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: corpo ? JSON.stringify(corpo) : undefined });
		if (r.ok) return invalidateAll();
		erro = ((await r.json().catch(() => ({}))) as { erros?: string[] }).erros?.[0] ?? 'Não foi possível concluir.';
	}

	function anular(t: (typeof data.tentativas)[number]) {
		if (confirm(`Anular a tentativa de ${t.nome}? Ela deixa de contar nas tentativas do aluno, que poderá refazer.`)) acao(`/api/admin/tentativas/${t.id}/anular`);
	}
	function acrescentar(t: (typeof data.tentativas)[number]) {
		const m = Number(prompt(`Quantos minutos acrescentar para ${t.nome}?`, '10'));
		if (Number.isInteger(m) && m > 0) acao(`/api/admin/tentativas/${t.id}/acrescimo`, { minutos: m });
	}
</script>

<svelte:head><title>Tentativas · QuestPlus</title></svelte:head>

<p><a href="/admin/atividades/{data.atividade.id}">← {data.atividade.titulo}</a></p>
<h1>Tentativas <span class="suave">({data.tentativas.length})</span></h1>
<p><a href="/admin/atividades/{data.atividade.id}/relatorio">Ver relatório da atividade (notas, exportar, imprimir)</a></p>
<p class="suave">
	{data.atividade.modo === 'prova' ? 'Prova' : 'Treino'} ·
	{data.atividade.tempo_total ? `${Math.round(data.atividade.tempo_total / 60)} min` : 'sem limite de tempo'} ·
	{data.atividade.tentativas_max ? `${data.atividade.tentativas_max} tentativa(s) por aluno` : 'tentativas ilimitadas'}{data.atividade.modo === 'prova' ? ' · vale a maior nota' : ''}
</p>

{#if erro}<p class="erro" role="alert">{erro}</p>{/if}

{#if data.tentativas.length === 0}
	<p class="suave">Ninguém respondeu ainda. Código da atividade: <code>{data.atividade.codigo}</code>.</p>
{:else}
	<div class="rolagem">
		<table>
			<thead><tr><th>Aluno</th><th>Turma</th><th>E-mail</th><th>Início</th><th>Situação</th><th>Pontos</th><th></th></tr></thead>
			<tbody>
				{#each data.tentativas as t (t.id)}
					<tr class:anulada={t.anulada}>
						<td>{t.nome}</td><td>{t.turma}</td><td>{t.email}</td><td>{formatarData(t.inicio_em)}</td>
						<td>{situacao(t)}{#if t.acrescimo_segundos} <span class="suave">(+{Math.round(t.acrescimo_segundos / 60)} min)</span>{/if}</td>
						<td>{t.status === 'finalizada' && !t.anulada ? `${t.nota ?? 0} de ${t.pontos_max ?? 0}` : '—'}{#if ehMelhor(t)} <span class="melhor">★ maior nota</span>{/if}</td>
						<td class="botoes">
							{#if emAndamento(t) && t.prazo_em}<button class="sec" onclick={() => acrescentar(t)}>+ tempo</button>{/if}
							<a class="rel" href="/admin/tentativas/{t.id}/relatorio">Relatório</a>
							{#if !t.anulada}<button class="sec" onclick={() => anular(t)}>Anular</button>{/if}
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
{/if}

<style>
	.rolagem { overflow-x: auto; }
	.melhor { font-size: 0.8rem; font-weight: 700; color: var(--sucesso); white-space: nowrap; }
	tr.anulada td { opacity: 0.55; text-decoration: line-through; }
	tr.anulada td:nth-child(5), tr.anulada td:last-child { text-decoration: none; }
	.botoes { white-space: nowrap; }
	.rel { display: inline-block; margin-right: 0.35rem; padding: 0.3rem 0.6rem; font-size: 0.85rem; font-weight: 600; color: var(--texto); text-decoration: none; border: 1px solid var(--borda); border-radius: 0.4rem; }
	td button { margin: 0 0.25rem 0 0; padding: 0.3rem 0.6rem; font-size: 0.85rem; }
</style>
