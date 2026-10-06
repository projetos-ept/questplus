<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import ConfirmarModal from '#lib/components/ConfirmarModal.svelte';

	let { data } = $props();
	let alvo = $state<(typeof data.itens)[number] | null>(null);
	let ciente = $state(false);
	let modal: ConfirmarModal;

	function pedirExclusao(s: (typeof data.itens)[number]) {
		alvo = s;
		ciente = false;
		modal.abrir();
	}

	async function excluir(): Promise<string | void> {
		if (!alvo) return;
		const r = await fetch(`/api/admin/suportes/${alvo.id}${(alvo.questoes ?? 0) > 0 ? '?desvincular=1' : ''}`, { method: 'DELETE' });
		if (r.ok) return void (await invalidateAll());
		return ((await r.json().catch(() => ({}))) as { erros?: string[] }).erros?.[0] ?? 'Não foi possível excluir o texto de apoio.';
	}
</script>

<svelte:head><title>Textos de apoio · QuestPlus</title></svelte:head>

<div class="topo">
	<h1>Textos de apoio</h1>
	<a class="botao" href="/admin/suportes/nova">Novo texto de apoio</a>
</div>

<ConfirmarModal bind:this={modal} titulo="Excluir este texto de apoio?" rotuloConfirmar="Excluir texto de apoio" perigo bloqueado={!!alvo && (alvo.questoes ?? 0) > 0 && !ciente} onconfirmar={excluir}>
	{#if alvo}
		<p class="resumo"><strong>{alvo.titulo}</strong>{#if alvo.imagens.length} · {alvo.imagens.length} imagem(ns){/if}</p>
		<p>Esta ação <strong>não pode ser desfeita</strong>. O texto e as imagens dele serão apagados.</p>
		{#if (alvo.questoes ?? 0) > 0}
			<p class="aviso-uso">Este texto é usado por <strong>{alvo.questoes} questão(ões)</strong>. Elas não serão apagadas, mas ficarão sem o texto de apoio.</p>
			<label class="ciente"><input type="checkbox" bind:checked={ciente} /> Entendo que as questões perderão este texto de apoio.</label>
		{/if}
	{/if}
</ConfirmarModal>

{#if data.itens.length === 0}
	<p class="suave">Nenhum texto de apoio cadastrado.</p>
{:else}
	<div class="rolagem">
		<table>
			<thead><tr><th>Título</th><th>Imagens</th><th>Questões</th><th></th></tr></thead>
			<tbody>
				{#each data.itens as s (s.id)}
					<tr>
						<td><a href="/admin/suportes/{s.id}">{s.titulo}</a></td>
						<td>{#if s.imagens.length}<img src="/midia/{s.imagens[0].chave}" alt="" width="48" /> <span class="suave">{s.imagens.length} imagem(ns)</span>{:else}<span class="suave">—</span>{/if}</td>
						<td>{s.questoes}</td>
						<td class="acoes"><button class="sec mini excluir" onclick={() => pedirExclusao(s)}>Excluir</button></td>
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
	.mini { margin: 0; padding: 0.25rem 0.55rem; font-size: 0.8rem; }
	.acoes { white-space: nowrap; }
	.excluir { color: var(--erro); border-color: var(--erro); }
	.resumo { padding: 0.5rem 0.75rem; overflow-wrap: anywhere; background: var(--fundo); border-radius: 0.4rem; }
	.aviso-uso { padding: 0.5rem 0.75rem; border: 1px solid var(--erro); border-radius: 0.4rem; }
	.ciente { display: flex; gap: 0.5rem; align-items: flex-start; font-weight: 400; }
</style>
