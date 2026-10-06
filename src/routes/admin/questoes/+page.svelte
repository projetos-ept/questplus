<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { formatoDe } from '#lib/questao';

	let { data } = $props();
	let erro = $state('');

	const paginas = $derived(Math.max(Math.ceil(data.total / data.limite), 1));
	const resumo = (t: string) => (t.length > 140 ? `${t.slice(0, 140)}…` : t);
	const link = (pagina: number) => {
		const p = new URLSearchParams();
		for (const [k, v] of Object.entries(data.filtros)) if (v) p.set(k, v);
		if (pagina > 1) p.set('pagina', String(pagina));
		const s = p.toString();
		return s ? `?${s}` : '?';
	};

	async function alternar(id: number, ativa: boolean) {
		erro = '';
		const r = await fetch(`/api/admin/questoes/${id}`, {
			method: 'PATCH',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ ativa })
		});
		if (r.ok) await invalidateAll();
		else erro = 'Não foi possível alterar a situação.';
	}
</script>

<svelte:head><title>Questões · QuestPlus</title></svelte:head>

<div class="topo">
	<h1>Questões <span class="suave">({data.total})</span></h1>
	<a class="botao" href="/admin/questoes/nova">Nova questão</a>
</div>

<form method="GET" class="filtros cartao">
	<label>Busca <input name="q" value={data.filtros.q} placeholder="Trecho do enunciado" /></label>
	<label>Formato
		<select name="tipo" value={data.filtros.tipo}>
			<option value="">Todos</option>
			<option value="mc">Múltipla escolha</option>
			<option value="vf">Verdadeiro ou falso</option>
		</select>
	</label>
	<label>Etiqueta
		<select name="etiqueta" value={data.filtros.etiqueta}>
			<option value="">Todas</option>
			{#each data.etiquetas as e}<option value={e}>{e}</option>{/each}
		</select>
	</label>
	<label>Situação
		<select name="ativa" value={data.filtros.ativa}>
			<option value="">Todas</option>
			<option value="1">Ativas</option>
			<option value="0">Inativas</option>
		</select>
	</label>
	<button type="submit">Filtrar</button>
</form>

{#if erro}<p class="erro" role="alert">{erro}</p>{/if}

{#if data.itens.length === 0}
	<p class="suave">Nenhuma questão encontrada.</p>
{:else}
	<div class="rolagem">
		<table>
			<thead><tr><th>Formato</th><th>Enunciado</th><th>Pontos</th><th>Situação</th><th></th></tr></thead>
			<tbody>
				{#each data.itens as q (q.id)}
					<tr class:inativa={!q.ativa}>
						<td>{formatoDe(q.tipo, q.config)}</td>
						<td>
							<a href="/admin/questoes/{q.id}">{resumo(q.enunciado)}</a>
							<div>{#each q.etiquetas as e}<span class="etiqueta">{e}</span>{/each}</div>
						</td>
						<td>{q.pontos}</td>
						<td>{q.ativa ? 'Ativa' : 'Inativa'}</td>
						<td><button class="sec" onclick={() => alternar(q.id, !q.ativa)}>{q.ativa ? 'Inativar' : 'Ativar'}</button></td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
	{#if paginas > 1}
		<p class="paginas">
			{#if data.pagina > 1}<a href={link(data.pagina - 1)}>← Anterior</a>{/if}
			<span class="suave">Página {data.pagina} de {paginas}</span>
			{#if data.pagina < paginas}<a href={link(data.pagina + 1)}>Próxima →</a>{/if}
		</p>
	{/if}
{/if}

<style>
	.topo {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem 1rem;
		align-items: center;
		justify-content: space-between;
	}
	.botao {
		padding: 0.55rem 1rem;
		font-weight: 600;
		color: var(--sobre-destaque);
		text-decoration: none;
		background: var(--destaque);
		border-radius: 0.4rem;
	}
	.filtros {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(10rem, 1fr));
		gap: 0 0.75rem;
		align-items: end;
		margin: 1rem 0;
	}
	.filtros button {
		margin-top: 1rem;
	}
	.rolagem {
		overflow-x: auto;
	}
	tr.inativa td {
		opacity: 0.6;
	}
	td button {
		margin: 0;
		padding: 0.3rem 0.6rem;
		font-size: 0.85rem;
	}
	.paginas {
		display: flex;
		gap: 1rem;
		align-items: center;
		justify-content: center;
	}
</style>
