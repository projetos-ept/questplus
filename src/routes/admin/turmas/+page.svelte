<script lang="ts">
	import { invalidateAll } from '$app/navigation';

	let { data } = $props();
	let editando = $state<number | null>(null);
	let nome = $state('');
	let curso = $state('');
	let periodo = $state('');
	let erros = $state<string[]>([]);
	let salvando = $state(false);

	function editar(t: (typeof data.turmas)[number] | null) {
		editando = t?.id ?? null;
		nome = t?.nome ?? '';
		curso = t?.curso ?? '';
		periodo = t?.periodo ?? '';
		erros = [];
	}

	async function enviar(url: string, metodo: string, corpo: unknown) {
		const r = await fetch(url, { method: metodo, headers: { 'content-type': 'application/json' }, body: JSON.stringify(corpo) });
		const j = (await r.json().catch(() => ({}))) as { erros?: string[] };
		return { ok: r.ok, erros: j.erros ?? ['Não foi possível concluir.'] };
	}

	async function salvar(e: SubmitEvent) {
		e.preventDefault();
		salvando = true;
		const atual = data.turmas.find((t) => t.id === editando);
		const r = await enviar(editando ? `/api/admin/turmas/${editando}` : '/api/admin/turmas', editando ? 'PUT' : 'POST', {
			nome, curso, periodo, ativa: atual?.ativa ?? true
		}).catch(() => ({ ok: false, erros: ['Falha de conexão.'] }));
		salvando = false;
		if (!r.ok) return (erros = r.erros);
		editar(null);
		await invalidateAll();
	}

	async function alternar(id: number, ativa: boolean) {
		const r = await enviar(`/api/admin/turmas/${id}`, 'PATCH', { ativa });
		if (r.ok) await invalidateAll();
		else erros = r.erros;
	}
</script>

<svelte:head><title>Turmas · QuestPlus</title></svelte:head>

<h1>Turmas</h1>
<p class="suave">As turmas ativas formam a lista suspensa que o aluno vê. Turmas não são apagadas, para preservar o histórico; inative as que não usa mais.</p>

<form onsubmit={salvar} class="cartao">
	<h2>{editando ? 'Editar turma' : 'Nova turma'}</h2>
	<div class="campos">
		<label>Nome <input bind:value={nome} required maxlength="100" placeholder="2º A" /></label>
		<label>Curso <input bind:value={curso} maxlength="100" placeholder="Enfermagem" /></label>
		<label>Ano ou módulo <input bind:value={periodo} maxlength="50" placeholder="2026 / Módulo II" /></label>
	</div>
	{#if erros.length}<ul class="erro" role="alert">{#each erros as e}<li>{e}</li>{/each}</ul>{/if}
	<div class="acoes">
		<button type="submit" disabled={salvando}>{salvando ? 'Salvando…' : editando ? 'Salvar alterações' : 'Adicionar turma'}</button>
		{#if editando}<button type="button" class="sec" onclick={() => editar(null)}>Cancelar</button>{/if}
	</div>
</form>

{#if data.turmas.length === 0}
	<p class="suave">Nenhuma turma cadastrada. Cadastre ao menos uma para montar atividades.</p>
{:else}
	<div class="rolagem">
		<table>
			<thead><tr><th>Turma</th><th>Curso</th><th>Ano ou módulo</th><th>Situação</th><th></th></tr></thead>
			<tbody>
				{#each data.turmas as t (t.id)}
					<tr class:inativa={!t.ativa}>
						<td>{t.nome}</td><td>{t.curso || '—'}</td><td>{t.periodo || '—'}</td>
						<td>{t.ativa ? 'Ativa' : 'Inativa'}</td>
						<td class="botoes">
							<button class="sec" onclick={() => editar(t)}>Editar</button>
							<button class="sec" onclick={() => alternar(t.id, !t.ativa)}>{t.ativa ? 'Inativar' : 'Ativar'}</button>
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
{/if}

<style>
	h2 { margin-top: 0; font-size: 1.1rem; }
	.campos { display: grid; grid-template-columns: repeat(auto-fit, minmax(12rem, 1fr)); gap: 0 1rem; }
	.acoes { display: flex; gap: 0.75rem; }
	.cartao { margin-bottom: 1.5rem; }
	.rolagem { overflow-x: auto; }
	tr.inativa td { opacity: 0.6; }
	.botoes { white-space: nowrap; }
	td button { margin: 0 0.25rem 0 0; padding: 0.3rem 0.6rem; font-size: 0.85rem; }
</style>
