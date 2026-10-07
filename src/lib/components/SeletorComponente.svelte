<script lang="ts">
	import { onMount } from 'svelte';

	type Componente = { id: number; nome: string; n_atividades: number };
	let { valor = $bindable<number | null>(null) }: { valor: number | null } = $props();

	let itens = $state<Componente[]>([]);
	let carregado = $state(false);
	let novoAberto = $state(false);
	let novoNome = $state('');
	let erro = $state('');
	let ocupado = $state(false);
	let dialogo: HTMLDialogElement;
	// edição e exclusão no modal
	let editando = $state<number | null>(null);
	let nomeEdicao = $state('');
	let excluindo = $state<number | null>(null);
	let erroModal = $state('');

	async function carregar() {
		try {
			const r = await fetch('/api/admin/componentes');
			if (r.ok) itens = ((await r.json()) as { itens: Componente[] }).itens;
		} catch {
			erro = 'Não foi possível carregar os componentes curriculares.';
		}
		carregado = true;
	}
	onMount(carregar);

	const enviar = async (url: string, metodo: string, corpo?: unknown) => {
		const r = await fetch(url, { method: metodo, headers: { 'content-type': 'application/json' }, body: corpo ? JSON.stringify(corpo) : undefined });
		return { ok: r.ok, j: (await r.json().catch(() => ({}))) as { id?: number; erros?: string[] } };
	};

	async function criar() {
		erro = '';
		ocupado = true;
		try {
			const { ok, j } = await enviar('/api/admin/componentes', 'POST', { nome: novoNome });
			if (!ok) return void (erro = j.erros?.[0] ?? 'Não foi possível cadastrar.');
			await carregar();
			valor = j.id ?? null;
			novoNome = '';
			novoAberto = false;
		} catch {
			erro = 'Falha de conexão. Tente de novo.';
		} finally {
			ocupado = false;
		}
	}

	function abrirGerenciar() {
		editando = null;
		excluindo = null;
		erroModal = '';
		dialogo.showModal();
	}

	async function salvarEdicao(id: number) {
		erroModal = '';
		ocupado = true;
		try {
			const { ok, j } = await enviar(`/api/admin/componentes/${id}`, 'PUT', { nome: nomeEdicao });
			if (!ok) return void (erroModal = j.erros?.[0] ?? 'Não foi possível salvar.');
			editando = null;
			await carregar();
		} catch {
			erroModal = 'Falha de conexão. Tente de novo.';
		} finally {
			ocupado = false;
		}
	}

	async function excluir(c: Componente) {
		erroModal = '';
		ocupado = true;
		try {
			const { ok, j } = await enviar(`/api/admin/componentes/${c.id}${c.n_atividades > 0 ? '?desvincular=1' : ''}`, 'DELETE');
			if (!ok) return void (erroModal = j.erros?.[0] ?? 'Não foi possível excluir.');
			if (valor === c.id) valor = null;
			excluindo = null;
			await carregar();
		} catch {
			erroModal = 'Falha de conexão. Tente de novo.';
		} finally {
			ocupado = false;
		}
	}
</script>

<div class="bloco">
	<label for="componente">Componente curricular (opcional)</label>
	<div class="linha">
		<select id="componente" bind:value={valor} disabled={!carregado}>
			<option value={null}>Nenhum</option>
			{#each itens as c (c.id)}<option value={c.id}>{c.nome}</option>{/each}
		</select>
		<button type="button" class="sec" onclick={() => (novoAberto = !novoAberto)} aria-expanded={novoAberto}>Novo</button>
		<button type="button" class="sec" onclick={abrirGerenciar} disabled={itens.length === 0}>Gerenciar</button>
	</div>
	{#if novoAberto}
		<div class="linha">
			<input bind:value={novoNome} maxlength="100" placeholder="Ex.: Hematologia Clínica" aria-label="Nome do novo componente curricular" onkeydown={(e) => e.key === 'Enter' && (e.preventDefault(), criar())} />
			<button type="button" onclick={criar} disabled={ocupado || novoNome.trim().length < 2}>Cadastrar e selecionar</button>
		</div>
	{/if}
	{#if erro}<p class="erro" role="alert">{erro}</p>{/if}
	<p class="suave">Aparece abaixo do título para o aluno e nos relatórios. Sem escolher, nada muda.</p>
</div>

<dialog bind:this={dialogo} aria-label="Componentes curriculares" onclick={(e) => e.target === dialogo && dialogo.close()}>
	<div class="corpo">
		<h2>Componentes curriculares</h2>
		{#if itens.length === 0}<p class="suave">Nenhum componente cadastrado.</p>{/if}
		<ul class="lista">
			{#each itens as c (c.id)}
				<li>
					{#if editando === c.id}
						<input bind:value={nomeEdicao} maxlength="100" aria-label="Novo nome" onkeydown={(e) => e.key === 'Enter' && salvarEdicao(c.id)} />
						<button type="button" onclick={() => salvarEdicao(c.id)} disabled={ocupado || nomeEdicao.trim().length < 2}>Salvar</button>
						<button type="button" class="sec" onclick={() => (editando = null)}>Cancelar</button>
					{:else if excluindo === c.id}
						<span class="aviso">
							{c.n_atividades > 0 ? `Excluir "${c.nome}"? ${c.n_atividades} atividade(s) ficarão sem componente.` : `Excluir "${c.nome}"?`}
						</span>
						<button type="button" class="perigo" onclick={() => excluir(c)} disabled={ocupado}>Excluir</button>
						<button type="button" class="sec" onclick={() => (excluindo = null)}>Cancelar</button>
					{:else}
						<span class="nome">{c.nome} <span class="suave">· {c.n_atividades} atividade(s)</span></span>
						<button type="button" class="sec" onclick={() => ((editando = c.id), (nomeEdicao = c.nome), (excluindo = null))}>Editar</button>
						<button type="button" class="sec excluir" onclick={() => ((excluindo = c.id), (editando = null))}>Excluir</button>
					{/if}
				</li>
			{/each}
		</ul>
		{#if erroModal}<p class="erro" role="alert">{erroModal}</p>{/if}
		<div class="acoes"><button type="button" class="sec" onclick={() => dialogo.close()}>Fechar</button></div>
	</div>
</dialog>

<style>
	.bloco { margin-top: 1rem; }
	.bloco > label { margin-top: 0; }
	.linha { display: flex; flex-wrap: wrap; gap: 0.5rem; align-items: center; margin-top: 0.4rem; }
	.linha select, .linha input { flex: 1 1 14rem; margin: 0; }
	.linha button { margin: 0; }
	dialog { width: min(34rem, calc(100vw - 2rem)); padding: 0; color: var(--texto); background: var(--superficie); border: 1px solid var(--borda); border-radius: var(--raio);
		box-shadow: var(--sombra); }
	dialog::backdrop { background: color-mix(in srgb, var(--texto) 55%, transparent); }
	.corpo { padding: 1.25rem; }
	h2 { margin: 0 0 0.75rem; font-size: 1.15rem; }
	.lista { padding: 0; margin: 0; list-style: none; }
	.lista li { display: flex; flex-wrap: wrap; gap: 0.4rem; align-items: center; padding: 0.5rem 0; border-bottom: 1px solid var(--borda); }
	.lista input { flex: 1 1 10rem; margin: 0; }
	.lista button { margin: 0; padding: 0.25rem 0.6rem; font-size: 0.85rem; }
	.nome, .aviso { flex: 1 1 12rem; overflow-wrap: anywhere; }
	.excluir { color: var(--erro); border-color: var(--erro); }
	.perigo { color: var(--sobre-erro); background: var(--erro); }
	.acoes { display: flex; justify-content: flex-end; margin-top: 1rem; }
	.acoes button { margin: 0; }
</style>
