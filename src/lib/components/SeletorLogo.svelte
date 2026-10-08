<script lang="ts">
	import { onMount } from 'svelte';

	type Logo = { id: number; nome: string; chave: string };
	let { valor = $bindable<number | null>(null) }: { valor: number | null } = $props();

	let itens = $state<Logo[]>([]);
	let carregado = $state(false);
	const escolhido = $derived(itens.find((l) => l.id === valor) ?? null);

	onMount(async () => {
		try {
			const r = await fetch('/api/admin/logos');
			if (r.ok) itens = ((await r.json()) as { itens: Logo[] }).itens;
		} catch {
			// sem lista: o seletor fica só com "Sem logo"
		}
		carregado = true;
	});
</script>

<div class="bloco">
	<label for="logo">Logo (opcional)</label>
	<div class="linha">
		<select id="logo" bind:value={valor} disabled={!carregado}>
			<option value={null}>Sem logo</option>
			{#each itens as l (l.id)}<option value={l.id}>{l.nome}</option>{/each}
		</select>
		{#if escolhido}<span class="mini"><img src="/midia/{escolhido.chave}" alt="Logo escolhido: {escolhido.nome}" /></span>{/if}
		<a class="gerenciar" href="/admin/perfil">Gerenciar logos</a>
	</div>
	<p class="suave">Aparece no canto superior esquerdo dos relatórios e acima do título na abertura da atividade para o aluno. Sem logo, nada muda.</p>
</div>

<style>
	.bloco { margin-top: 1rem; }
	.bloco > label { margin-top: 0; }
	.linha { display: flex; flex-wrap: wrap; gap: 0.5rem 0.75rem; align-items: center; margin-top: 0.4rem; }
	.linha select { flex: 1 1 14rem; margin: 0; }
	.mini { display: grid; place-items: center; width: 44px; height: 44px; overflow: hidden; background: #fff; border: 1px solid var(--borda); border-radius: 6px; }
	.mini img { width: 100%; height: 100%; object-fit: contain; }
	.gerenciar { font-weight: var(--peso-acao); }
</style>
