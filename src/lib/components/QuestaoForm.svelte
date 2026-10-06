<script lang="ts">
	import { goto } from '$app/navigation';
	import { DISCIPLINAS } from '#lib/disciplinas';
	import { entradaDe, type Formulario } from '#lib/questao';
	import { protegerSaida } from '#lib/saida';
	import { untrack } from 'svelte';

	let { id = null, inicial, suportes }: { id?: number | null; inicial: Formulario; suportes: { id: number; titulo: string }[] } = $props();

	let f = $state<Formulario>(untrack(() => structuredClone($state.snapshot(inicial))));
	let erros = $state<string[]>([]);
	let salvando = $state(false);
	const original = untrack(() => JSON.stringify($state.snapshot(f)));
	let salvo = false;
	protegerSaida(() => !salvo && JSON.stringify($state.snapshot(f)) !== original);

	const nAlt = $derived(f.formato === 'mc5' ? 5 : 4);
	const letras = ['A', 'B', 'C', 'D', 'E'];

	function trocarFormato() {
		if (f.formato === 'mc4' && f.correta === 4) f.correta = null;
	}

	async function salvar(e: SubmitEvent) {
		e.preventDefault();
		erros = [];
		salvando = true;
		try {
			const r = await fetch(id ? `/api/admin/questoes/${id}` : '/api/admin/questoes', {
				method: id ? 'PUT' : 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify(entradaDe(f))
			});
			const corpo = (await r.json().catch(() => ({}))) as { erros?: string[] };
			if (!r.ok) {
				erros = corpo.erros ?? ['Não foi possível salvar.'];
				return;
			}
			salvo = true;
			await goto('/admin/questoes');
		} catch {
			erros = ['Falha de conexão. Tente de novo.'];
		} finally {
			salvando = false;
		}
	}
</script>

<form onsubmit={salvar} class="cartao">
	<label>Formato
		<select bind:value={f.formato} onchange={trocarFormato}>
			<option value="mc4">Múltipla escolha com 4 alternativas (MC4)</option>
			<option value="mc5">Múltipla escolha com 5 alternativas (MC5)</option>
			<option value="vf">Verdadeiro ou falso</option>
			<option value="aberta">Aberta (corrigida por rubrica, com apoio de IA)</option>
		</select>
	</label>

	<label>Texto de apoio (opcional)
		<select bind:value={f.suporte_id}>
			<option value={null}>Nenhum</option>
			{#each suportes as s}<option value={s.id}>{s.titulo}</option>{/each}
		</select>
	</label>

	<label>Enunciado <textarea bind:value={f.enunciado} required maxlength="4000"></textarea></label>

	{#if f.formato === 'aberta'}
		<fieldset>
			<legend>Resposta de referência e rubrica</legend>
			<p class="suave">O aluno nunca vê esta parte. O sistema confere os conceitos por regra, a IA sugere um nível de 0 a 4 e você confirma antes de a nota valer.</p>
			<label>Resposta de referência <textarea bind:value={f.referencia} required maxlength="1200" rows="4"></textarea></label>
			<p class="suave sub">Conceitos-chave (de 3 a 6 é o ideal) e sinônimos aceitos, separados por vírgula</p>
			{#each f.conceitos as c, i}
				<div class="linha">
					<input aria-label="Conceito {i + 1}" placeholder="Conceito (ex.: captação de glicose)" bind:value={c.nome} maxlength="100" />
					<input aria-label="Sinônimos do conceito {i + 1}" placeholder="Sinônimos (ex.: entrada de glicose na célula)" bind:value={c.sinonimos} />
					<button type="button" class="sec" disabled={f.conceitos.length === 1} onclick={() => f.conceitos.splice(i, 1)}>Remover</button>
				</div>
			{/each}
			{#if f.conceitos.length < 6}<button type="button" class="sec" onclick={() => f.conceitos.push({ nome: '', sinonimos: '' })}>Adicionar conceito</button>{/if}
			<p class="suave sub">Pares de oposição (opcional): se a resposta usa o lado contrário ao da referência, o sistema alerta um possível erro de conceito</p>
			{#each f.oposicoes as o, i}
				<div class="linha">
					<input aria-label="Termo {i + 1}A" placeholder="aumenta" bind:value={o.a} maxlength="60" />
					<span>×</span>
					<input aria-label="Termo {i + 1}B" placeholder="reduz" bind:value={o.b} maxlength="60" />
					<button type="button" class="sec" onclick={() => f.oposicoes.splice(i, 1)}>Remover</button>
				</div>
			{/each}
			{#if f.oposicoes.length < 10}<button type="button" class="sec" onclick={() => f.oposicoes.push({ a: '', b: '' })}>Adicionar par de oposição</button>{/if}
			<label>Mínimo de caracteres (abaixo disso a nota é 0 sem usar IA)
				<input type="number" min="0" max="500" step="1" bind:value={f.min_chars} />
			</label>
			<p class="suave sub">Percentual dos pontos da questão por nível</p>
			<div class="niveis">
				{#each f.niveis as _, i}
					<label>Nível {i} <input type="number" min="0" max="100" step="5" bind:value={f.niveis[i]} /></label>
				{/each}
			</div>
		</fieldset>
	{:else if f.formato === 'vf'}
		<fieldset>
			<legend>Afirmações</legend>
			<p class="suave">Marcar errado não desconta ponto; a afirmação errada apenas não pontua.</p>
			{#each f.afirmacoes as a, i}
				<div class="linha">
					<input aria-label="Afirmação {i + 1}" bind:value={a.texto} required maxlength="500" />
					<select aria-label="Valor da afirmação {i + 1}" bind:value={a.valor}>
						<option value={true}>Verdadeira</option>
						<option value={false}>Falsa</option>
					</select>
					<button type="button" class="sec" disabled={f.afirmacoes.length === 1} onclick={() => f.afirmacoes.splice(i, 1)}>Remover</button>
				</div>
			{/each}
			{#if f.afirmacoes.length < 10}
				<button type="button" class="sec" onclick={() => f.afirmacoes.push({ texto: '', valor: true })}>Adicionar afirmação</button>
			{/if}
		</fieldset>
	{:else}
		<fieldset>
			<legend>Alternativas (marque a correta)</legend>
			{#each letras.slice(0, nAlt) as letra, i}
				<div class="linha">
					<input type="radio" name="correta" aria-label="Alternativa {letra} é a correta" value={i} bind:group={f.correta} />
					<span class="letra">{letra}</span>
					<input aria-label="Texto da alternativa {letra}" bind:value={f.alternativas[i]} required maxlength="500" />
				</div>
			{/each}
			<p class="suave">As alternativas são embaralhadas a cada tentativa do aluno; a letra mostrada é a da posição na tela.</p>
		</fieldset>
	{/if}

	<label>Explicação (opcional) <textarea bind:value={f.explicacao} maxlength="4000"></textarea></label>
	<label>Pontos <input type="number" step="0.5" min="0.5" max="100" bind:value={f.pontos} required /></label>
	<label>Disciplina {#if !id}<span class="suave">(obrigatória: vira a primeira etiqueta)</span>{/if}
		<select bind:value={f.disciplina} required={!id}>
			<option value="" disabled={!id}>{id ? 'Sem disciplina (questão antiga)' : 'Escolha…'}</option>
			{#each DISCIPLINAS as d}<option value={d.id}>{d.nome}</option>{/each}
		</select>
	</label>
	<label>Outras etiquetas (assunto, separadas por vírgula) <input bind:value={f.etiquetas} placeholder="ciclo de vida, malária" /></label>
	<label class="check"><input type="checkbox" bind:checked={f.ativa} /> Questão ativa (pode entrar em atividades novas)</label>

	{#if erros.length}
		<ul class="erro" role="alert">{#each erros as e}<li>{e}</li>{/each}</ul>
	{/if}

	<div class="acoes">
		<button type="submit" disabled={salvando}>{salvando ? 'Salvando…' : 'Salvar'}</button>
		<a href="/admin/questoes">Cancelar</a>
	</div>
</form>

<style>
	fieldset {
		margin: 1rem 0 0;
		padding: 0.75rem 1rem 1rem;
		border: 1px solid var(--borda);
		border-radius: 0.5rem;
	}
	legend {
		padding: 0 0.4rem;
		font-weight: 600;
	}
	.linha {
		display: flex;
		gap: 0.5rem;
		align-items: center;
		margin-top: 0.5rem;
	}
	.linha input:not([type='radio']) {
		flex: 1;
		margin-top: 0;
	}
	.linha select {
		width: auto;
		margin-top: 0;
	}
	.linha button {
		margin: 0;
	}
	.letra {
		font-weight: 700;
		min-width: 1.2rem;
	}
	.check {
		display: flex;
		gap: 0.5rem;
		align-items: center;
		font-weight: 400;
	}
	.sub { margin: 0.75rem 0 0; }
	.niveis { display: grid; grid-template-columns: repeat(5, 1fr); gap: 0.5rem; }
	.acoes {
		display: flex;
		gap: 1rem;
		align-items: center;
	}
</style>
