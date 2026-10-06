<script lang="ts">
	import InstrucaoIA from '#lib/components/InstrucaoIA.svelte';
	import { TAMANHO_BLOCO, lerArquivo, type SuporteImportado } from '#lib/importacao';

	type Item = { indice: number; ok: boolean; erros: string[]; duplicada: boolean; formato?: string; enunciado?: string; gabarito?: string };

	let texto = $state('');
	let nomeArquivo = $state('');
	let errosLeitura = $state<string[]>([]);
	let analise = $state<{ suportes: SuporteImportado[]; questoes: unknown[] } | null>(null);
	let itens = $state<Item[]>([]);
	let fase = $state<'inicial' | 'verificando' | 'verificado' | 'importando' | 'concluido'>('inicial');
	let progresso = $state(0);
	let pularDuplicadas = $state(true);
	let soProblemas = $state(false);
	let erro = $state('');
	let resumo = $state<{ criadas: number; puladas: number; invalidas: number; suportes: number; avisos: string[] } | null>(null);

	const validas = $derived(itens.filter((i) => i.ok));
	const invalidas = $derived(itens.filter((i) => !i.ok));
	const repetidas = $derived(itens.filter((i) => i.ok && i.duplicada));
	const aImportar = $derived(validas.length - (pularDuplicadas ? repetidas.length : 0));
	const mostradas = $derived(soProblemas ? itens.filter((i) => !i.ok || i.duplicada) : itens);
	const ocupado = $derived(fase === 'verificando' || fase === 'importando');

	/** Linhas com erro não voltam do servidor com o enunciado; usa o do item original para a pessoa saber qual é. */
	const enunciadoDe = (i: Item) => {
		const bruto = analise?.questoes[i.indice] as { enunciado?: unknown } | undefined;
		return i.enunciado ?? (typeof bruto?.enunciado === 'string' ? bruto.enunciado : '');
	};
	const resumir = (t: string) => (t.length > 110 ? `${t.slice(0, 110)}…` : t);
	const blocos = <T,>(lista: T[], n: number) => Array.from({ length: Math.ceil(lista.length / n) }, (_, i) => lista.slice(i * n, i * n + n));

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
		analise = null;
		const lido = lerArquivo(texto);
		errosLeitura = lido.ok ? [] : lido.erros;
		if (!lido.ok) return void (fase = 'inicial');
		analise = lido.valor;
		fase = 'verificando';
		progresso = 0;
		try {
			const refs = lido.valor.suportes.map((s) => s.ref);
			for (const [i, bloco] of blocos(lido.valor.questoes, TAMANHO_BLOCO).entries()) {
				const r = (await chamar('/api/admin/importar?validar=1', { questoes: bloco, inicio: i * TAMANHO_BLOCO, refs })) as { itens: Item[] };
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
		if (!analise || aImportar < 1) return;
		if (!confirm(`Importar ${aImportar} questão(ões)? Você poderá excluí-las depois, uma a uma.`)) return;
		erro = '';
		fase = 'importando';
		progresso = 0;
		const r = { criadas: 0, puladas: 0, invalidas: invalidas.length, suportes: 0, avisos: [] as string[] };
		try {
			const mapa: Record<string, number> = {};
			for (const bloco of blocos(analise.suportes, 4)) {
				const s = (await chamar('/api/admin/importar', { suportes: bloco })) as { mapa: Record<string, number>; criados: number; avisos: string[] };
				Object.assign(mapa, s.mapa);
				r.suportes += s.criados;
				r.avisos.push(...s.avisos);
			}
			for (const [i, bloco] of blocos(analise.questoes, TAMANHO_BLOCO).entries()) {
				const x = (await chamar('/api/admin/importar', { questoes: bloco, inicio: i * TAMANHO_BLOCO, mapa, pularDuplicadas })) as { criadas: number; puladas: number };
				r.criadas += x.criadas;
				r.puladas += x.puladas;
				progresso = Math.min((i + 1) * TAMANHO_BLOCO, analise.questoes.length);
			}
			resumo = r;
			fase = 'concluido';
		} catch (e) {
			resumo = r;
			erro = `${(e as Error).message} Já foram criadas ${r.criadas} questão(ões); confira a lista antes de tentar de novo (as repetidas serão puladas).`;
			fase = 'verificado';
		}
	}

	function recomecar() {
		texto = nomeArquivo = '';
		itens = [];
		analise = null;
		resumo = null;
		erro = '';
		errosLeitura = [];
		fase = 'inicial';
	}
</script>

<svelte:head><title>Importar questões · QuestPlus</title></svelte:head>

<p><a href="/admin/questoes">← Questões</a></p>
<h1>Importar questões</h1>

<h2>1. Gere o JSON com uma IA <span class="suave">(opcional)</span></h2>
<InstrucaoIA />

<h2>2. Cole o JSON ou envie o arquivo</h2>
<div class="cartao">
	<label>Cole aqui <textarea bind:value={texto} rows="8" class="mono" placeholder={'{ "questoes": [ ... ] }'} disabled={ocupado}></textarea></label>
	<div class="linha">
		<button type="button" onclick={verificar} disabled={ocupado || !texto.trim()}>{fase === 'verificando' ? `Verificando… ${progresso}` : 'Verificar'}</button>
		<span class="suave">ou</span>
		<label class="arquivo">Enviar arquivo .json <input type="file" accept=".json,application/json,text/plain" onchange={escolherArquivo} disabled={ocupado} /></label>
		{#if nomeArquivo}<span class="suave">{nomeArquivo}</span>{/if}
	</div>
	<p class="suave">Nada é gravado nesta etapa. O sistema confere o formato e mostra o gabarito de cada questão para você revisar.</p>
	{#if errosLeitura.length}<ul class="erro" role="alert">{#each errosLeitura as e}<li>{e}</li>{/each}</ul>{/if}
	{#if erro}<p class="erro" role="alert">{erro}</p>{/if}
</div>

{#if fase === 'concluido' && resumo}
	<div class="cartao ok" role="status">
		<h2>Importação concluída</h2>
		<ul>
			<li><strong>{resumo.criadas}</strong> questão(ões) criada(s){resumo.suportes ? `, ${resumo.suportes} texto(s) de apoio` : ''}.</li>
			{#if resumo.puladas}<li>{resumo.puladas} já existia(m) e foi(foram) pulada(s).</li>{/if}
			{#if resumo.invalidas}<li>{resumo.invalidas} com erro não foi(foram) importada(s).</li>{/if}
			{#each resumo.avisos as a}<li class="suave">{a}</li>{/each}
		</ul>
		<a href="/admin/questoes">Ver as questões</a> · <button type="button" class="sec" onclick={recomecar}>Importar outro arquivo</button>
	</div>
{:else if itens.length}
	<h2>3. Revise e importe</h2>
	<div class="cartao">
		<p>
			<strong>{itens.length}</strong> questão(ões) lida(s):
			<span class="boa">✔ {validas.length - repetidas.length} nova(s)</span>
			{#if repetidas.length}· <span>↷ {repetidas.length} já existe(m)</span>{/if}
			{#if invalidas.length}· <span class="erro">✘ {invalidas.length} com erro</span>{/if}
		</p>
		<label class="check"><input type="checkbox" bind:checked={pularDuplicadas} /> Pular questões que já existem (mesmo formato e enunciado)</label>
		<div class="linha">
			<button type="button" onclick={importar} disabled={ocupado || aImportar < 1}>
				{fase === 'importando' ? `Importando… ${progresso} de ${itens.length}` : `Importar ${aImportar} questão(ões)`}
			</button>
			{#if invalidas.length || repetidas.length}
				<label class="check"><input type="checkbox" bind:checked={soProblemas} /> Mostrar só as com problema</label>
			{/if}
		</div>
		{#if invalidas.length}<p class="suave">As questões com erro não serão importadas. Corrija o JSON (ou peça à IA para corrigir) e verifique de novo.</p>{/if}
	</div>

	<div class="rolagem">
		<table>
			<thead><tr><th>#</th><th>Formato</th><th>Enunciado</th><th>Gabarito</th><th>Situação</th></tr></thead>
			<tbody>
				{#each mostradas as i (i.indice)}
					<tr class:erro-linha={!i.ok}>
						<td>{i.indice + 1}</td>
						<td>{i.formato ?? '—'}</td>
						<td>{enunciadoDe(i) ? resumir(enunciadoDe(i)) : '—'}</td>
						<td>{i.gabarito ?? '—'}</td>
						<td>
							{#if !i.ok}<span class="erro">✘ {i.erros.join(' ')}</span>
							{:else if i.duplicada}<span>↷ Já existe{pularDuplicadas ? ' (será pulada)' : ' (será duplicada)'}</span>
							{:else}<span class="boa">✔ Válida</span>{/if}
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
{/if}

<style>
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
