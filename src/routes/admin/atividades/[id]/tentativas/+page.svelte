<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import ConfirmarModal from '#lib/components/ConfirmarModal.svelte';
	import { formatarData } from '#lib/data';
	import { expirou } from '#lib/atividade';

	let { data } = $props();
	let erro = $state('');
	let alvo = $state<(typeof data.tentativas)[number] | null>(null);
	let ciente = $state(false);
	let modal: ConfirmarModal;
	let alvoAnular = $state<(typeof data.tentativas)[number] | null>(null);
	let modalAnular: ConfirmarModal;

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

	function pedirAnulacao(t: (typeof data.tentativas)[number]) {
		alvoAnular = t;
		modalAnular.abrir();
	}
	async function anular(): Promise<string | void> {
		if (!alvoAnular) return;
		const r = await fetch(`/api/admin/tentativas/${alvoAnular.id}/anular`, { method: 'POST' });
		if (r.ok) return void (await invalidateAll());
		return ((await r.json().catch(() => ({}))) as { erros?: string[] }).erros?.[0] ?? 'Não foi possível anular a tentativa.';
	}
	function pedirExclusao(t: (typeof data.tentativas)[number]) {
		alvo = t;
		ciente = false;
		modal.abrir();
	}
	async function excluir(): Promise<string | void> {
		if (!alvo) return;
		const r = await fetch(`/api/admin/tentativas/${alvo.id}`, { method: 'DELETE' });
		if (r.ok) return void (await invalidateAll());
		return ((await r.json().catch(() => ({}))) as { erros?: string[] }).erros?.[0] ?? 'Não foi possível excluir a tentativa.';
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

<ConfirmarModal bind:this={modalAnular} titulo="Anular esta tentativa?" rotuloConfirmar="Anular tentativa" perigo onconfirmar={anular}>
	{#if alvoAnular}
		<p class="resumo"><strong>{alvoAnular.nome}</strong> · {alvoAnular.email}<br />Início {formatarData(alvoAnular.inicio_em)}</p>
		<p>A tentativa <strong>deixa de contar</strong> nas notas e nas tentativas do aluno, que poderá refazer. Ela continua na lista, riscada, e depois pode ser excluída de vez.</p>
		<p class="suave">Anular não pode ser desfeito.</p>
	{/if}
</ConfirmarModal>

<ConfirmarModal bind:this={modal} titulo="Excluir esta tentativa?" rotuloConfirmar="Excluir tentativa" perigo bloqueado={!ciente} onconfirmar={excluir}>
	{#if alvo}
		<p class="resumo"><strong>{alvo.nome}</strong> · {alvo.email}<br />Início {formatarData(alvo.inicio_em)}</p>
		<p>Esta ação <strong>não pode ser desfeita</strong>. Apaga a tentativa, as respostas e a correção das questões abertas dela. Questões, textos de apoio e as outras tentativas do aluno não mudam.</p>
		<p class="suave">A tentativa já está anulada, então as notas e os relatórios não mudam.</p>
		<label class="ciente"><input type="checkbox" bind:checked={ciente} /> Entendo que esta tentativa será apagada de vez.</label>
	{/if}
</ConfirmarModal>

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
							{#if !t.anulada}<button class="sec" onclick={() => pedirAnulacao(t)}>Anular</button>{:else}<button class="sec excluir" onclick={() => pedirExclusao(t)}>Excluir</button>{/if}
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
	tr.anulada td:nth-child(5), tr.anulada td:last-child { text-decoration: none; opacity: 1; }
	tr.anulada td:last-child { opacity: 1; }
	.excluir { color: var(--erro); border-color: var(--erro); }
	.resumo { padding: 0.5rem 0.75rem; overflow-wrap: anywhere; background: var(--fundo); border-radius: 0.4rem; }
	.ciente { display: flex; gap: 0.5rem; align-items: flex-start; font-weight: 400; }
	.botoes { white-space: nowrap; }
	.rel { display: inline-block; margin-right: 0.35rem; padding: 0.3rem 0.6rem; font-size: 0.85rem; font-weight: 600; color: var(--texto); text-decoration: none; border: 1px solid var(--borda); border-radius: 0.4rem; }
	td button { margin: 0 0.25rem 0 0; padding: 0.3rem 0.6rem; font-size: 0.85rem; }
</style>
