<script lang="ts">
	import { formatarData } from '#lib/data';
	let { data } = $props();
</script>

<svelte:head><title>Tentativas · QuestPlus</title></svelte:head>

<p><a href="/admin/atividades/{data.atividade.id}">← {data.atividade.titulo}</a></p>
<h1>Tentativas <span class="suave">({data.tentativas.length})</span></h1>

{#if data.tentativas.length === 0}
	<p class="suave">Ninguém respondeu ainda. Código da atividade: <code>{data.atividade.codigo}</code>.</p>
{:else}
	<div class="rolagem">
		<table>
			<thead><tr><th>Aluno</th><th>Turma</th><th>E-mail</th><th>Início</th><th>Situação</th><th>Pontos</th></tr></thead>
			<tbody>
				{#each data.tentativas as t (t.id)}
					<tr>
						<td>{t.nome}</td><td>{t.turma}</td><td>{t.email}</td><td>{formatarData(t.inicio_em)}</td>
						<td>{t.status === 'finalizada' ? 'Finalizada' : 'Em andamento'}</td>
						<td>{t.status === 'finalizada' ? `${t.nota ?? 0} de ${t.pontos_max ?? 0}` : '—'}</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
{/if}

<style>
	.rolagem { overflow-x: auto; }
</style>
