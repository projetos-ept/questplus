<script lang="ts">
	import InstrucaoSuporteIA from '#lib/components/InstrucaoSuporteIA.svelte';
	import { TAMANHO_BLOCO_SUPORTES, lerArquivoSuportes } from '#lib/importacao-suportes';

	type Item = { indice: number; ok: boolean; erros: string[]; avisos: string[]; duplicada: boolean; titulo?: string; resumo?: string };

	let texto = $state('');
	let nomeArquivo = $state('');
	let errosLeitura = $state<string[]>([]);
	let brutos = $state<unknown[]>([]);
	let itens = $state<Item[]>([]);
	let fase = $state<'inicial' | 'verificando' | 'verificado' | 'importando' | 'concluido'>('inicial');
	let progresso = $state(0);
	let pularDuplicadas = $state(true);
	let erro = $state('');
	let resumo = $state<{ criados: number; puladas: number; invalidos: number } | null>(null);

	const validos = $derived(itens.filter((i) => i.ok));
	const invalidos = $derived(itens.filter((i) => !i.ok));
	const repetidos = $derived(itens.filter((i) => i.ok && i.duplicada));
	const aImportar = $derived(validos.length - (pularDuplicadas ? repetidos.length : 0));
	const ocupado = $derived(fase === 'verificando' || fase === 'importando');
	const blocos = <T,>(lista: T[], n: number) => Array.from({ length: Math.ceil(lista.length / n) }, (_, i) => lista.slice(i * n, i * n + n));
	const tituloDe = (i: Item) => i.titulo ?? ((brutos[i.indice] as { titulo?: unknown } | undefined)?.titulo as string | undefined) ?? '—';

	async function chamar(url: string, corpo: unknown) {
		const r = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(corpo) });
		const j = (await r.json().catch(() => ({}))) as Record<string, unknown> & { erros?: string[] };
		if (!r.ok) throw new Error(j.erros?.[0] ?? 'Falha ao falar com o servidor.');
		return j;
	}

	async function escolherArquivo(e: Event) {
		const input = e.currentTarget as HTMLInputElement;
		const arquivo = input.files?.[0];
		if (!arquivo) return;
		nomeArquivo = arquivo.name;
		texto = await arquivo.text();
		input.value = '';
		await verificar();
	}

	async function verificar() {
		erro = '';
		resumo = null;
		itens = [];
		const lido = lerArquivoSuportes(texto);
		errosLeitura = lido.ok ? [] : lido.erros;
		if (!lido.ok) return void (fase = 'inicial');
		brutos = lido.valor.suportes;
		fase = 'verificando';
		progresso = 0;
		try {
			for (const [i, bloco] of blocos(brutos, TAMANHO_BLOCO_SUPORTES).entries()) {
				const r = (await chamar('/api/admin/suportes/importar?validar=1', { suportes: bloco, inicio: i * TAMANHO_BLOCO_SUPORTES })) as { itens: Item[] };
				itens.push(...r.itens);
				progresso = itens.length;
			}
			fase = 'verificado';
		} catch (e) {
			erro = (e as Error).message;
			fase = 'inicial';
		}
	}

	async function importar() {
		if (aImportar < 1) return;
		if (!confirm(`Importar ${aImportar} texto(s) de apoio? Você poderá excluí-los depois, um a um.`)) return;
		erro = '';
		fase = 'importando';
		progresso = 0;
		const r = { criados: 0, puladas: 0, invalidos: invalidos.length };
		try {
			for (const [i, bloco] of blocos(brutos, TAMANHO_BLOCO_SUPORTES).entries()) {
				const x = (await chamar('/api/admin/suportes/importar', { suportes: bloco, inicio: i * TAMANHO_BLOCO_SUPORTES, pularDuplicadas })) as { criados: number; puladas: number };
				r.criados += x.criados;
				r.puladas += x.puladas;
				progresso = Math.min((i + 1) * TAMANHO_BLOCO_SUPORTES, brutos.length);
			}
			resumo = r;
			fase = 'concluido';
		} catch (e) {
			resumo = r;
			erro = `${(e as Error).message} Já foram criados ${r.criados} texto(s); confira a lista antes de tentar de novo (os repetidos serão pulados).`;
			fase = 'verificado';
		}
	}

	function recomecar() {
		texto = nomeArquivo = '';
		itens = [];
		brutos = [];
		resumo = null;
		erro = '';
		errosLeitura = [];
		fase = 'inicial';
	}
</script>

<svelte:head><title>Importar textos de apoio · QuestPlus</title></svelte:head>

<p><a href="/admin/suportes">← Textos de apoio</a></p>
<h1>Importar textos de apoio</h1>

<h2>1. Gere o JSON com uma IA <span class="suave">(opcional)</span></h2>
<InstrucaoSuporteIA />

<h2>2. Cole o JSON ou envie o arquivo</h2>
<div class="cartao">
	<label>Cole aqui <textarea bind:value={texto} rows="8" class="mono" placeholder={'{ "suportes": [ ... ] }'} disabled={ocupado}></textarea></label>
	<div class="linha">
		<button type="button" onclick={verificar} disabled={ocupado || !texto.trim()}>{fase === 'verificando' ? `Verificando… ${progresso}` : 'Verificar'}</button>
		<span class="suave">ou</span>
		<label class="arquivo">Enviar arquivo .json <input type="file" accept=".json,application/json,text/plain" onchange={escolherArquivo} disabled={ocupado} /></label>
		{#if nomeArquivo}<span class="suave">{nomeArquivo}</span>{/if}
	</div>
	<p class="suave">Nada é gravado nesta etapa. O sistema confere o formato e mostra um resumo de cada texto.</p>
	{#if errosLeitura.length}<ul class="erro" role="alert">{#each errosLeitura as e}<li>{e}</li>{/each}</ul>{/if}
	{#if erro}<p class="erro" role="alert">{erro}</p>{/if}
</div>

{#if fase === 'concluido' && resumo}
	<div class="cartao ok" role="status">
		<h2>Importação concluída</h2>
		<ul>
			<li><strong>{resumo.criados}</strong> texto(s) de apoio criado(s).</li>
			{#if resumo.puladas}<li>{resumo.puladas} já existia(m) e foi(foram) pulado(s).</li>{/if}
			{#if resumo.invalidos}<li>{resumo.invalidos} com erro não foi(foram) importado(s).</li>{/if}
		</ul>
		<a href="/admin/suportes">Ver os textos de apoio</a> · <button type="button" class="sec" onclick={recomecar}>Importar outro arquivo</button>
	</div>
{:else if itens.length}
	<h2>3. Revise e importe</h2>
	<div class="cartao">
		<p>
			<strong>{itens.length}</strong> texto(s) lido(s):
			<span class="boa">✔ {validos.length - repetidos.length} novo(s)</span>
			{#if repetidos.length}· <span>↷ {repetidos.length} já existe(m)</span>{/if}
			{#if invalidos.length}· <span class="erro">✘ {invalidos.length} com erro</span>{/if}
		</p>
		<label class="check"><input type="checkbox" bind:checked={pularDuplicadas} /> Pular textos que já existem (mesmo título e texto)</label>
		<div class="linha">
			<button type="button" onclick={importar} disabled={ocupado || aImportar < 1}>
				{fase === 'importando' ? `Importando… ${progresso} de ${itens.length}` : `Importar ${aImportar} texto(s)`}
			</button>
		</div>
		{#if invalidos.length}<p class="suave">Os textos com erro não serão importados. Corrija o JSON (ou peça à IA) e verifique de novo.</p>{/if}
	</div>

	<div class="rolagem">
		<table>
			<thead><tr><th>#</th><th>Título</th><th>Conteúdo</th><th>Situação</th></tr></thead>
			<tbody>
				{#each itens as i (i.indice)}
					<tr class:erro-linha={!i.ok}>
						<td>{i.indice + 1}</td>
						<td>{tituloDe(i)}</td>
						<td>{i.resumo ?? '—'}</td>
						<td>
							{#if !i.ok}<span class="erro">✘ {i.erros.join(' ')}</span>
							{:else if i.duplicada}<span>↷ Já existe{pularDuplicadas ? ' (será pulado)' : ' (será duplicado)'}</span>
							{:else}<span class="boa">✔ Válido</span>{/if}
							{#if i.ok && i.avisos.length}<div class="aviso-disc">⚠ {i.avisos.join(' ')}</div>{/if}
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
{/if}

<style>
	.aviso-disc { margin-top: 0.25rem; font-size: 0.85rem; color: var(--erro); }
	h2 { margin: 1.75rem 0 0.5rem; font-size: 1.15rem; }
	.mono { font-family: ui-monospace, monospace; font-size: 0.85rem; }
	.linha { display: flex; flex-wrap: wrap; gap: 0.75rem 1rem; align-items: center; }
	.linha button { margin: 1rem 0 0; }
	.arquivo { display: inline-flex; gap: 0.5rem; align-items: center; margin: 1rem 0 0; font-weight: 400; }
	.arquivo input { margin: 0; width: auto; }
	.check { display: flex; gap: 0.5rem; align-items: center; font-weight: 400; margin-top: 0.5rem; }
	.rolagem { margin-top: 1rem; overflow-x: auto; }
	.boa { color: var(--ok); font-weight: 600; }
	.ok { border-color: var(--ok); margin-top: 1.5rem; }
	.ok h2 { margin-top: 0; }
	tr.erro-linha td { background: color-mix(in srgb, var(--erro) 8%, transparent); }
	td { overflow-wrap: anywhere; }
</style>
