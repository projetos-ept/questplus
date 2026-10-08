<script lang="ts">
	import { onMount } from 'svelte';
	import ConfirmarModal from './ConfirmarModal.svelte';
	import { LIMITE_LOGOS, TAMANHO_MAX_LOGO, nomeDoArquivo } from '#lib/logos';

	type Logo = { id: number; nome: string; chave: string; n_atividades: number };

	let logos = $state<Logo[]>([]);
	let rascunhos = $state<{ k: number; nome: string }[]>([]); // espaços vazios esperando o envio
	let carregado = $state(false);
	let erro = $state('');
	let msg = $state('');
	let ocupado = $state(false);
	let proximo = 0;
	let alvo = $state<Logo | null>(null);
	let modal: ConfirmarModal;

	const total = $derived(logos.length + rascunhos.length);
	const limite = LIMITE_LOGOS;

	async function carregar() {
		try {
			const r = await fetch('/api/admin/logos');
			if (r.ok) logos = ((await r.json()) as { itens: Logo[] }).itens;
		} catch {
			erro = 'Não foi possível carregar os logos.';
		}
		if (!logos.length && !rascunhos.length) rascunhos = [{ k: proximo++, nome: '' }]; // começa com 1 espaço
		carregado = true;
	}
	onMount(carregar);

	function adicionarEspaco() {
		if (total < limite) rascunhos.push({ k: proximo++, nome: '' });
	}
	const descartar = (k: number) => (rascunhos = rascunhos.filter((x) => x.k !== k));

	function validar(arquivo: File | undefined): string {
		if (!arquivo) return 'Escolha uma imagem.';
		if (arquivo.size > TAMANHO_MAX_LOGO) return 'O logo passa de 1 MB.';
		if (!/^image\/(png|jpeg|webp)$/.test(arquivo.type)) return 'Use PNG, JPG ou WEBP.';
		return '';
	}

	async function enviar(url: string, metodo: 'POST' | 'PUT', f: FormData): Promise<boolean> {
		erro = msg = '';
		ocupado = true;
		try {
			const r = await fetch(url, { method: metodo, body: f });
			const j = (await r.json().catch(() => ({}))) as { erros?: string[] };
			if (!r.ok) {
				erro = j.erros?.[0] ?? 'Não foi possível salvar o logo.';
				return false;
			}
			await carregar();
			return true;
		} catch {
			erro = 'Falha de conexão. Tente de novo.';
			return false;
		} finally {
			ocupado = false;
		}
	}

	async function novo(k: number, nome: string, e: Event) {
		const input = e.currentTarget as HTMLInputElement;
		const arquivo = input.files?.[0];
		const problema = validar(arquivo);
		if (problema) return void ((erro = problema), (input.value = ''));
		const f = new FormData();
		f.set('arquivo', arquivo!);
		f.set('nome', nome.trim() || nomeDoArquivo(arquivo!.name));
		if (await enviar('/api/admin/logos', 'POST', f)) {
			descartar(k);
			msg = 'Logo salvo.';
		}
		input.value = '';
	}
	async function trocar(l: Logo, e: Event) {
		const input = e.currentTarget as HTMLInputElement;
		const arquivo = input.files?.[0];
		const problema = validar(arquivo);
		if (problema) return void ((erro = problema), (input.value = ''));
		const f = new FormData();
		f.set('arquivo', arquivo!);
		if (await enviar(`/api/admin/logos/${l.id}`, 'PUT', f)) msg = 'Imagem trocada.';
		input.value = '';
	}
	async function renomear(l: Logo, nome: string) {
		if (!nome.trim() || nome.trim() === l.nome) return;
		const f = new FormData();
		f.set('nome', nome);
		if (await enviar(`/api/admin/logos/${l.id}`, 'PUT', f)) msg = 'Nome salvo.';
	}

	function pedirExclusao(l: Logo) {
		alvo = l;
		modal.abrir();
	}
	async function excluir(): Promise<string | void> {
		if (!alvo) return;
		const r = await fetch(`/api/admin/logos/${alvo.id}${alvo.n_atividades > 0 ? '?desvincular=1' : ''}`, { method: 'DELETE' });
		if (!r.ok) return ((await r.json().catch(() => ({}))) as { erros?: string[] }).erros?.[0] ?? 'Não foi possível excluir o logo.';
		await carregar();
		msg = 'Logo excluído.';
	}
</script>

<section aria-labelledby="t-logos" class="logos">
	<h3 id="t-logos">Logos ({logos.length} de {limite})</h3>
	<p class="suave">
		Quadrado no canto superior esquerdo dos relatórios e acima do título na abertura da atividade. Você escolhe o logo em cada atividade; sem escolher, nada muda. PNG, JPG ou WEBP, até 1 MB (SVG não é aceito). Quadrada fica melhor: a imagem é ajustada sem cortar.
	</p>

	<ul class="grade">
		{#each logos as l (l.id)}
			<li class="slot">
				<div class="quad"><img src="/midia/{l.chave}" alt="Logo {l.nome}" /></div>
				<label class="nome">Nome
					<input value={l.nome} maxlength="60" onchange={(e) => renomear(l, e.currentTarget.value)} />
				</label>
				<p class="suave uso">{l.n_atividades > 0 ? `Em ${l.n_atividades} atividade(s)` : 'Sem uso'}</p>
				<div class="acoes">
					<button type="button" class="sec" disabled={ocupado} onclick={(e) => (e.currentTarget.nextElementSibling as HTMLInputElement).click()}>Trocar imagem</button>
					<input type="file" hidden aria-label="Arquivo da nova imagem do logo {l.nome}" accept="image/png,image/jpeg,image/webp" disabled={ocupado} onchange={(e) => trocar(l, e)} />
					<button type="button" class="sec excluir" onclick={() => pedirExclusao(l)} disabled={ocupado}>Excluir</button>
				</div>
			</li>
		{/each}
		{#each rascunhos as r (r.k)}
			<li class="slot vazio">
				<div class="quad"><span>Espaço vazio</span></div>
				<label class="nome">Nome (opcional)
					<input bind:value={r.nome} maxlength="60" placeholder="Ex.: Escola" />
				</label>
				<div class="acoes">
					<button type="button" disabled={ocupado} onclick={(e) => (e.currentTarget.nextElementSibling as HTMLInputElement).click()}>Enviar imagem</button>
					<input type="file" hidden aria-label="Arquivo da imagem do novo logo" accept="image/png,image/jpeg,image/webp" disabled={ocupado} onchange={(e) => novo(r.k, r.nome, e)} />
					{#if logos.length > 0 || rascunhos.length > 1}<button type="button" class="sec" onclick={() => descartar(r.k)}>Remover espaço</button>{/if}
				</div>
			</li>
		{/each}
	</ul>

	{#if carregado && total < limite}<button type="button" class="sec" onclick={adicionarEspaco}>+ Adicionar logo</button>{:else if carregado}<p class="suave">Limite de {limite} logos atingido. Exclua um para enviar outro.</p>{/if}
	{#if erro}<p class="erro" role="alert">{erro}</p>{/if}
	{#if msg}<p class="ok-msg" role="status">{msg}</p>{/if}
</section>

<ConfirmarModal bind:this={modal} titulo="Excluir este logo?" rotuloConfirmar="Excluir logo" perigo onconfirmar={excluir}>
	{#if alvo}
		<p class="resumo"><strong>{alvo.nome}</strong></p>
		{#if alvo.n_atividades > 0}
			<p>Este logo está em <strong>{alvo.n_atividades} atividade(s)</strong>. Elas ficam <strong>sem logo</strong> (relatórios e abertura voltam ao formato sem logo).</p>
		{:else}
			<p>Nenhuma atividade usa este logo.</p>
		{/if}
		<p class="suave">Não pode ser desfeito.</p>
	{/if}
</ConfirmarModal>

<style>
	.logos { margin-top: 1.25rem; }
	h3 { margin: 0 0 0.25rem; font-size: var(--escala-h4); }
	.grade { display: grid; grid-template-columns: repeat(auto-fill, minmax(13rem, 1fr)); gap: 14px; padding: 0; margin: 12px 0; list-style: none; }
	.slot { display: flex; flex-direction: column; gap: 8px; align-items: stretch; padding: 14px; border: var(--borda-espessura) var(--borda-estilo) var(--borda-cor); border-radius: 16px; }
	.quad { display: grid; place-items: center; width: 132px; height: 132px; margin: 0 auto; overflow: hidden; background: #fff; border: 1px dashed var(--borda); border-radius: 12px; }
	.quad img { width: 100%; height: 100%; object-fit: contain; }
	.quad span { padding: 0.5rem; font-size: var(--escala-sm); color: var(--texto-secundario); text-align: center; }
	.nome { margin: 0; font-size: var(--escala-sm); }
	.nome input { margin-top: 0.15rem; }
	.uso { margin: 0; font-size: var(--escala-sm); text-align: center; }
	.acoes { display: flex; flex-wrap: wrap; gap: 6px; justify-content: center; }
	.acoes button { display: inline-flex; align-items: center; min-height: 34px; margin: 0; padding: 0.25rem 0.8rem; font-size: 0.85rem; font-weight: var(--peso-acao); color: var(--sobre-primaria); cursor: pointer; background: var(--primaria); border: 1px solid var(--primaria); border-radius: calc(var(--raio) / 2); }
	.acoes button.sec { color: var(--primaria); background: var(--superficie); }
	.acoes .excluir { color: var(--erro); border-color: var(--erro); }
	.ok-msg { color: var(--sucesso); font-weight: var(--peso-acao); }
	.resumo { padding: 0.5rem 0.75rem; overflow-wrap: anywhere; background: var(--fundo); border-radius: 0.4rem; }
</style>
