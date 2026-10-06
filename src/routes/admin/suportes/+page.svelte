<script lang="ts">
	let { data } = $props();
</script>

<svelte:head><title>Textos de apoio · QuestPlus</title></svelte:head>

<div class="topo">
	<h1>Textos de apoio</h1>
	<a class="botao" href="/admin/suportes/nova">Novo texto de apoio</a>
</div>

{#if data.itens.length === 0}
	<p class="suave">Nenhum texto de apoio cadastrado.</p>
{:else}
	<div class="rolagem">
		<table>
			<thead><tr><th>Título</th><th>Imagem</th><th>Questões</th></tr></thead>
			<tbody>
				{#each data.itens as s (s.id)}
					<tr>
						<td><a href="/admin/suportes/{s.id}">{s.titulo}</a></td>
						<td>{#if s.imagem_chave}<img src="/midia/{s.imagem_chave}" alt="" width="48" />{:else}<span class="suave">—</span>{/if}</td>
						<td>{s.questoes}</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
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
	.rolagem {
		overflow-x: auto;
	}
	img {
		height: auto;
		border-radius: 0.25rem;
	}
</style>
