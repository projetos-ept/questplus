<script lang="ts">
	import { goto, invalidateAll } from '$app/navigation';
	import ConfirmarModal from '#lib/components/ConfirmarModal.svelte';
	import { formatarData } from '#lib/data';

	let { data } = $props();
	let filtro = $state<'todas' | 'no_prazo' | 'antes' | 'encerrada' | 'inativa'>('todas');
	let turmaFiltro = $state(''); // id da turma ativa escolhida ('' = todas)
	let erro = $state('');
	let copiado = $state<number | null>(null);
	let alvo = $state<(typeof data.atividades)[number] | null>(null);
	let ciente = $state(false);
	let modal: ConfirmarModal;

	async function clonar(id: number) {
		erro = '';
		const r = await fetch(`/api/admin/atividades/${id}/clonar`, { method: 'POST' });
		const j = (await r.json().catch(() => ({}))) as { id?: number; erros?: string[] };
		if (r.ok) await goto(`/admin/atividades/${j.id}?clonada=1`);
		else erro = j.erros?.[0] ?? 'Não foi possível clonar a atividade.';
	}

	function pedirExclusao(a: (typeof data.atividades)[number]) {
		alvo = a;
		ciente = false;
		modal.abrir();
	}

	async function excluir(): Promise<string | void> {
		if (!alvo) return;
		const r = await fetch(`/api/admin/atividades/${alvo.id}${alvo.n_tentativas > 0 ? '?tentativas=1' : ''}`, { method: 'DELETE' });
		if (r.ok) return void (await invalidateAll());
		return ((await r.json().catch(() => ({}))) as { erros?: string[] }).erros?.[0] ?? 'Não foi possível excluir a atividade.';
	}

	const nomes = { no_prazo: 'No prazo', antes: 'Ainda não abriu', encerrada: 'Encerrada', inativa: 'Inativa' } as const;
	const abas = [['todas', 'Todas'], ['no_prazo', 'No prazo'], ['antes', 'Ainda não abriu'], ['encerrada', 'Encerradas'], ['inativa', 'Inativas']] as const;
	const lista = $derived(
		data.atividades.filter((a) => (filtro === 'todas' || a.estado === filtro) && (!turmaFiltro || a.turmas.some((t) => String(t.id) === turmaFiltro)))
	);
	const nasTurmas = (a: (typeof data.atividades)[number]) => a.turmas.map((t) => t.nome).join(', ') || '—';

	const link = (codigo: string) => `${location.origin}/${codigo}`;

	async function copiar(id: number, codigo: string) {
		try {
			await navigator.clipboard.writeText(link(codigo));
			copiado = id;
			setTimeout(() => (copiado = null), 2000);
		} catch {
			erro = `Copie manualmente: ${link(codigo)}`;
		}
	}

	async function alternar(id: number, ativa: boolean) {
		erro = '';
		const r = await fetch(`/api/admin/atividades/${id}/situacao`, {
			method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ativa })
		});
		if (r.ok) await invalidateAll();
		else erro = 'Não foi possível alterar a situação.';
	}
</script>

<svelte:head><title>Atividades · QuestPlus</title></svelte:head>

<div class="topo">
	<h1>Atividades</h1>
	<a class="botao" href="/admin/atividades/nova">Nova atividade</a>
</div>

<div class="abas" role="group" aria-label="Filtrar por situação">
	{#each abas as [chave, rotulo]}
		<button class="sec" aria-pressed={filtro === chave} onclick={() => (filtro = chave)}>{rotulo}</button>
	{/each}
</div>

<div class="filtro-turma">
	<label>Turma (só as ativas)
		<select bind:value={turmaFiltro}>
			<option value="">Todas as turmas</option>
			{#each data.turmas as t (t.id)}<option value={String(t.id)}>{t.nome}</option>{/each}
		</select>
	</label>
	{#if turmaFiltro}<button type="button" class="link" onclick={() => (turmaFiltro = '')}>Limpar</button>{/if}
	<span class="suave">{lista.length} de {data.atividades.length} atividade(s)</span>
</div>

{#if erro}<p class="erro" role="alert">{erro}</p>{/if}

<ConfirmarModal bind:this={modal} titulo="Excluir esta atividade?" rotuloConfirmar="Excluir atividade" perigo bloqueado={!!alvo && alvo.n_tentativas > 0 && !ciente} onconfirmar={excluir}>
	{#if alvo}
		<p class="resumo"><strong>{alvo.titulo}</strong> · código <code>{alvo.codigo}</code></p>
		<p>Esta ação <strong>não pode ser desfeita</strong>. As questões e as turmas não são apagadas, só a atividade e o link dela.</p>
		{#if alvo.n_tentativas > 0}
			<p class="aviso-tent">Há <strong>{alvo.n_tentativas} tentativa(s)</strong> de alunos. Excluir apaga também as respostas e notas delas.</p>
			<label class="ciente"><input type="checkbox" bind:checked={ciente} /> Entendo que as tentativas e respostas dos alunos serão apagadas.</label>
			<p class="suave">Para só fechar o link, use <em>Inativar</em>.</p>
		{/if}
	{/if}
</ConfirmarModal>

{#if lista.length === 0}
	<p class="suave">Nenhuma atividade {filtro === 'todas' && !turmaFiltro ? 'cadastrada' : 'com esses filtros'}.</p>
{:else}
	<div class="rolagem">
		<table>
			<thead><tr><th>Atividade</th><th>Turmas</th><th>Código</th><th>Prazo</th><th>Situação</th><th>Questões</th><th>Tentativas</th><th></th></tr></thead>
			<tbody>
				{#each lista as a (a.id)}
					<tr class:inativa={a.estado === 'inativa'}>
						<td><a href="/admin/atividades/{a.id}">{a.titulo}</a>{#if a.componente}<div class="suave">{a.componente}</div>{/if}</td>
						<td class="suave turmas">{nasTurmas(a)}</td>
						<td class="cod"><code>{a.codigo}</code> <button class="sec mini" onclick={() => copiar(a.id, a.codigo)}>{copiado === a.id ? 'Link copiado' : 'Copiar link'}</button></td>
						<td>{#if a.abre_em}<div>abre {formatarData(a.abre_em)}</div>{/if}<div>{a.fecha_em ? `fecha ${formatarData(a.fecha_em)}` : 'sem prazo'}</div></td>
						<td>{nomes[a.estado]}</td>
						<td>{a.n_questoes}</td>
						<td><a href="/admin/atividades/{a.id}/tentativas">{a.n_tentativas}</a></td>
						<td class="acoes">
							<button class="sec mini" onclick={() => alternar(a.id, !a.ativa)}>{a.ativa ? 'Inativar' : 'Ativar'}</button>
							<a class="sec mini link-botao" href="/admin/atividades/{a.id}/relatorio">Relatório</a>
								{#if a.abertas_pendentes > 0}<a class="sec mini link-botao" href="/admin/atividades/{a.id}/abertas">Corrigir abertas ({a.abertas_pendentes})</a>{/if}
							<button class="sec mini" onclick={() => clonar(a.id)}>Clonar</button>
							<button class="sec mini excluir" onclick={() => pedirExclusao(a)}>Excluir</button>
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
{/if}

<style>
	.topo { display: flex; flex-wrap: wrap; gap: 0.5rem 1rem; align-items: center; justify-content: space-between; }
	.botao { padding: 0.55rem 1rem; font-weight: 600; color: var(--sobre-primaria); text-decoration: none; background: var(--primaria); border-radius: 0.4rem; }
	.abas { display: flex; flex-wrap: wrap; gap: 0.5rem; margin: 0.5rem 0 1rem; }
	.abas button { margin: 0; padding: 0.35rem 0.8rem; font-size: 0.9rem; }
	.abas button[aria-pressed='true'] { color: var(--sobre-primaria); background: var(--primaria); border-color: var(--primaria); }
	.rolagem { overflow-x: auto; }
	.filtro-turma { display: flex; flex-wrap: wrap; gap: 0.5rem 1rem; align-items: end; margin-bottom: 0.75rem; }
	.filtro-turma label { margin: 0; min-width: 14rem; }
	.link { margin: 0; padding: 0; font-weight: 400; color: var(--primaria); text-decoration: underline; background: none; border: 0; }
	.turmas { max-width: 12rem; overflow-wrap: anywhere; }
	tr.inativa td { opacity: 0.6; }
	.cod { white-space: nowrap; }
	.mini { margin: 0 0.25rem 0 0; padding: 0.25rem 0.55rem; font-size: 0.8rem; }
	.acoes { min-width: 12rem; }
	.acoes > * { margin-bottom: 0.3rem; }
	.link-botao { display: inline-block; margin: 0 0.25rem 0 0; padding: 0.25rem 0.55rem; font-size: 0.8rem; font-weight: 600; color: var(--texto); text-decoration: none; border: 1px solid var(--borda); border-radius: 0.4rem; }
	.excluir { color: var(--erro); border-color: var(--erro); }
	.resumo { padding: 0.5rem 0.75rem; overflow-wrap: anywhere; background: var(--fundo); border-radius: 0.4rem; }
	.aviso-tent { padding: 0.5rem 0.75rem; border: 1px solid var(--erro); border-radius: 0.4rem; }
	.ciente { display: flex; gap: 0.5rem; align-items: flex-start; font-weight: 400; }
</style>
