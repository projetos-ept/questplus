<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { untrack } from 'svelte';
	import LogosPerfil from '#lib/components/LogosPerfil.svelte';
	import { validarNomeProfessor } from '#lib/relatorio';

	let { data } = $props();
	let nome = $state(untrack(() => data.professor ?? ''));
	let erro = $state('');
	let msg = $state('');
	let salvando = $state(false);

	async function salvar(e: SubmitEvent) {
		e.preventDefault();
		erro = msg = '';
		const v = validarNomeProfessor(nome);
		if (!v.ok) return void (erro = v.erro);
		salvando = true;
		try {
			const r = await fetch('/api/admin/perfil', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ professor: v.valor }) });
			const j = (await r.json().catch(() => ({}))) as { erros?: string[] };
			if (!r.ok) erro = j.erros?.[0] ?? 'Não foi possível salvar.';
			else {
				nome = v.valor ?? '';
				await invalidateAll();
				msg = v.valor ? 'Nome salvo. Ele já aparece nos relatórios.' : 'Nome removido: os relatórios saem sem a linha do professor.';
			}
		} catch {
			erro = 'Falha de conexão. Tente de novo.';
		} finally {
			salvando = false;
		}
	}
</script>

<svelte:head><title>Perfil · QuestPlus</title></svelte:head>

<h1>Perfil</h1>
<form class="cartao" onsubmit={salvar} aria-labelledby="t-prof">
	<h2 id="t-prof">Professor(a) nos relatórios</h2>
	<label for="nome">Nome do(a) professor(a)</label>
	<input id="nome" bind:value={nome} maxlength="100" autocomplete="name" placeholder="Ex.: Maria Souza" aria-describedby="ajuda" aria-invalid={!!erro} />
	<p id="ajuda" class="suave">Aparece no cabeçalho de todos os relatórios (da atividade, individuais, completo e resumido), abaixo do componente curricular. Vazio: os relatórios saem sem essa linha.</p>
	{#if erro}<p class="erro" role="alert">{erro}</p>{/if}
	{#if msg}<p class="ok-msg" role="status">{msg}</p>{/if}
	<button type="submit" disabled={salvando}>{salvando ? 'Salvando…' : 'Salvar'}</button>
</form>

<div class="cartao logos-cartao"><LogosPerfil /></div>

<style>
	form { max-width: 34rem; margin-top: 1rem; }
	.logos-cartao { max-width: 56rem; margin-top: 1rem; }
	h2 { margin: 0 0 0.25rem; font-size: var(--escala-h3); }
	.ok-msg { color: var(--sucesso); font-weight: var(--peso-acao); }
</style>
