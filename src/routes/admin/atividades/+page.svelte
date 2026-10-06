<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { formatarData } from '#lib/data';

	let { data } = $props();
	let filtro = $state<'todas' | 'no_prazo' | 'antes' | 'encerrada' | 'inativa'>('todas');
	let erro = $state('');
	let copiado = $state<number | null>(null);

	const nomes = { no_prazo: 'No prazo', antes: 'Ainda não abriu', encerrada: 'Encerrada', inativa: 'Inativa' } as const;
	const abas = [['todas', 'Todas'], ['no_prazo', 'No prazo'], ['antes', 'Ainda não abriu'], ['encerrada', 'Encerradas'], ['inativa', 'Inativas']] as const;
	const lista = $derived(data.atividades.filter((a) => filtro === 'todas' || a.estado === filtro));

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

{#if erro}<p class="erro" role="alert">{erro}</p>{/if}

{#if lista.length === 0}
	<p class="suave">Nenhuma atividade {filtro === 'todas' ? 'cadastrada' : 'neste filtro'}.</p>
{:else}
	<div class="rolagem">
		<table>
			<thead><tr><th>Atividade</th><th>Código</th><th>Prazo</th><th>Situação</th><th>Questões</th><th>Tentativas</th><th></th></tr></thead>
			<tbody>
				{#each lista as a (a.id)}
					<tr class:inativa={a.estado === 'inativa'}>
						<td><a href="/admin/atividades/{a.id}">{a.titulo}</a></td>
						<td class="cod"><code>{a.codigo}</code> <button class="sec mini" onclick={() => copiar(a.id, a.codigo)}>{copiado === a.id ? 'Link copiado' : 'Copiar link'}</button></td>
						<td>{#if a.abre_em}<div>abre {formatarData(a.abre_em)}</div>{/if}<div>{a.fecha_em ? `fecha ${formatarData(a.fecha_em)}` : 'sem prazo'}</div></td>
						<td>{nomes[a.estado]}</td>
						<td>{a.n_questoes}</td>
						<td><a href="/admin/atividades/{a.id}/tentativas">{a.n_tentativas}</a></td>
						<td><button class="sec mini" onclick={() => alternar(a.id, !a.ativa)}>{a.ativa ? 'Inativar' : 'Ativar'}</button></td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
{/if}

<style>
	.topo { display: flex; flex-wrap: wrap; gap: 0.5rem 1rem; align-items: center; justify-content: space-between; }
	.botao { padding: 0.55rem 1rem; font-weight: 600; color: var(--sobre-destaque); text-decoration: none; background: var(--destaque); border-radius: 0.4rem; }
	.abas { display: flex; flex-wrap: wrap; gap: 0.5rem; margin: 0.5rem 0 1rem; }
	.abas button { margin: 0; padding: 0.35rem 0.8rem; font-size: 0.9rem; }
	.abas button[aria-pressed='true'] { color: var(--sobre-destaque); background: var(--destaque); border-color: var(--destaque); }
	.rolagem { overflow-x: auto; }
	tr.inativa td { opacity: 0.6; }
	.cod { white-space: nowrap; }
	.mini { margin: 0; padding: 0.25rem 0.55rem; font-size: 0.8rem; }
</style>
