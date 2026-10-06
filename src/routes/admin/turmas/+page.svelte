<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import ConfirmarModal from '#lib/components/ConfirmarModal.svelte';

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

	// ---------- excluir (só pelo caminho seguro) ----------
	type Turma = (typeof data.turmas)[number];
	let alvo = $state<Turma | null>(null);
	let ciente = $state(false);
	let modal: ConfirmarModal;
	const comTentativas = $derived((alvo?.n_tentativas ?? 0) > 0);
	const emAtividades = $derived((alvo?.n_atividades ?? 0) > 0);

	function pedirExclusao(t: Turma) {
		alvo = t;
		ciente = false;
		modal.abrir();
	}
	async function excluir(): Promise<string | void> {
		if (!alvo) return;
		const r = await fetch(`/api/admin/turmas/${alvo.id}${emAtividades ? '?desvincular=1' : ''}`, { method: 'DELETE' });
		if (r.ok) return void (await invalidateAll());
		return ((await r.json().catch(() => ({}))) as { erros?: string[] }).erros?.[0] ?? 'Não foi possível excluir a turma.';
	}
	async function inativarDoModal() {
		if (!alvo) return;
		await alternar(alvo.id, false);
		modal.fechar();
	}

	async function alternar(id: number, ativa: boolean) {
		const r = await enviar(`/api/admin/turmas/${id}`, 'PATCH', { ativa });
		if (r.ok) await invalidateAll();
		else erros = r.erros;
	}
</script>

<svelte:head><title>Turmas · QuestPlus</title></svelte:head>

<h1>Turmas</h1>
<p class="suave">As turmas ativas formam a lista suspensa que o aluno vê. Para tirar uma turma de circulação sem perder nada, inative. Excluir só vale para turma sem tentativas de alunos; se estiver em atividades, o sistema pede confirmação e a retira delas.</p>

<ConfirmarModal bind:this={modal} titulo="Excluir esta turma?" rotuloConfirmar="Excluir turma" perigo bloqueado={comTentativas || (emAtividades && !ciente)} onconfirmar={excluir}>
	{#if alvo}
		<p class="resumo"><strong>{alvo.nome}</strong>{#if alvo.curso} · {alvo.curso}{/if}{#if alvo.periodo} · {alvo.periodo}{/if}</p>
		{#if comTentativas}
			<p class="aviso-uso">Esta turma tem <strong>{alvo.n_tentativas} tentativa(s)</strong> de alunos registradas{#if emAtividades} e está em <strong>{alvo.n_atividades} atividade(s)</strong>{/if}. Excluí-la apagaria esse histórico, por isso <strong>a exclusão está bloqueada</strong>.</p>
			<p><strong>Caminho seguro:</strong> inativar. A turma deixa de aparecer na lista que o aluno vê e as notas e relatórios continuam intactos.</p>
			{#if alvo.ativa}<button type="button" onclick={inativarDoModal}>Inativar esta turma agora</button>{:else}<p class="suave">Esta turma já está inativa.</p>{/if}
		{:else if emAtividades}
			<p class="aviso-uso">Esta turma está em <strong>{alvo.n_atividades} atividade(s)</strong>: {alvo.atividades?.join(', ')}{(alvo.n_atividades ?? 0) > (alvo.atividades?.length ?? 0) ? ' e outras' : ''}. Não há tentativas de alunos, então dá para excluir, mas ela será <strong>retirada dessas atividades</strong>. Se alguma atividade ficar só com esta turma, a exclusão é recusada.</p>
			<label class="ciente"><input type="checkbox" bind:checked={ciente} /> Entendo que a turma será retirada de {alvo.n_atividades} atividade(s) e excluída. Não dá para desfazer.</label>
			<p class="suave">Prefere manter? <button type="button" class="link" onclick={inativarDoModal} disabled={!alvo.ativa}>Inativar em vez de excluir</button></p>
		{:else}
			<p>Esta turma não está em nenhuma atividade e não tem tentativas. A exclusão <strong>não pode ser desfeita</strong>.</p>
		{/if}
	{/if}
</ConfirmarModal>

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
			<thead><tr><th>Turma</th><th>Curso</th><th>Ano ou módulo</th><th>Situação</th><th>Em uso</th><th></th></tr></thead>
			<tbody>
				{#each data.turmas as t (t.id)}
					<tr class:inativa={!t.ativa}>
						<td>{t.nome}</td><td>{t.curso || '—'}</td><td>{t.periodo || '—'}</td>
						<td>{t.ativa ? 'Ativa' : 'Inativa'}</td>
						<td class="suave">{t.n_atividades ?? 0} atividade(s) · {t.n_tentativas ?? 0} tentativa(s)</td>
						<td class="botoes">
							<button class="sec" onclick={() => editar(t)}>Editar</button>
							<button class="sec" onclick={() => alternar(t.id, !t.ativa)}>{t.ativa ? 'Inativar' : 'Ativar'}</button>
							<button class="sec excluir" onclick={() => pedirExclusao(t)}>Excluir</button>
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
	.excluir { color: var(--erro); border-color: var(--erro); }
	.resumo { padding: 0.5rem 0.75rem; overflow-wrap: anywhere; background: var(--fundo); border-radius: 0.4rem; }
	.aviso-uso { padding: 0.5rem 0.75rem; border: 1px solid var(--erro); border-radius: 0.4rem; }
	.ciente { display: flex; gap: 0.5rem; align-items: flex-start; font-weight: 400; }
	.link { display: inline; margin: 0; padding: 0; font-weight: 400; color: var(--destaque); text-decoration: underline; background: none; border: 0; }
	td button { margin: 0 0.25rem 0 0; padding: 0.3rem 0.6rem; font-size: 0.85rem; }
</style>
