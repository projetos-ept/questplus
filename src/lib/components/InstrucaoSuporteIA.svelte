<script lang="ts">
	import { onMount } from 'svelte';
	import { DISCIPLINAS } from '#lib/disciplinas';
	import { montarPromptSuporteIA, type OpcoesPromptSuporte } from '#lib/importacao-suportes';
	import { carregarOpcoesPromptSuporte, salvarOpcoesPromptSuporte } from '#lib/promptOpcoes';

	let opcoes = $state<OpcoesPromptSuporte>(carregarOpcoesPromptSuporte());
	let lembrar = false;
	// o botão "Copiar instrução para IA" da lista usa as mesmas opções; guardá-las evita copiar uma instrução diferente da que se vê aqui
	onMount(() => (lembrar = true));
	$effect(() => {
		const atual = $state.snapshot(opcoes) as OpcoesPromptSuporte;
		if (lembrar) salvarOpcoesPromptSuporte(atual);
	});
	let copiado = $state(false);
	let campo: HTMLTextAreaElement | undefined = $state();
	const prompt = $derived(montarPromptSuporteIA(opcoes));

	async function copiar() {
		try {
			await navigator.clipboard.writeText(prompt);
		} catch {
			campo?.select();
			return;
		}
		copiado = true;
		setTimeout(() => (copiado = false), 2500);
	}
</script>

<div class="cartao">
	<div class="campos">
		<label class="largo">Tema ou conteúdo base <textarea bind:value={opcoes.tema} rows="3" placeholder="Ex.: Fase pré-analítica da coleta de sangue venoso, ou cole aqui o texto da aula"></textarea></label>
		<label>Quantidade de textos <input type="number" min="1" max="20" bind:value={opcoes.quantidade} /></label>
		<label>Tamanho de cada texto
			<select bind:value={opcoes.tamanho}>
				<option value="curto">Curto (cerca de 600 caracteres)</option>
				<option value="médio">Médio (cerca de 1200)</option>
				<option value="longo">Longo (cerca de 2500)</option>
			</select>
		</label>
		<label>Disciplina (1ª etiqueta)
			<select bind:value={opcoes.disciplina}>
				<option value="">A IA escolhe pela lista</option>
				{#each DISCIPLINAS as d}<option value={d.id}>{d.nome}</option>{/each}
			</select>
		</label>
		<label>Outras etiquetas (vírgula) <input bind:value={opcoes.etiquetas} placeholder="coleta, pré-analítica" /></label>
	</div>
	<label class="check"><input type="checkbox" bind:checked={opcoes.comDiagrama} /> Permitir diagrama (Mermaid) quando o tema pedir fluxo, ciclo ou sequência</label>
	<label>Instrução pronta para a IA
		<textarea bind:this={campo} readonly rows="10" value={prompt} onfocus={(e) => e.currentTarget.select()} class="mono"></textarea>
	</label>
	<div class="acoes">
		<button type="button" onclick={copiar}>{copiado ? 'Instrução copiada ✔' : 'Copiar instrução'}</button>
		<span class="suave">Cole no ChatGPT, Claude, Gemini etc. e traga a resposta para o passo 2. <strong>Confira o conteúdo</strong>: a IA erra.</span>
	</div>
</div>

<style>
	.campos { display: grid; grid-template-columns: repeat(auto-fit, minmax(11rem, 1fr)); gap: 0 1rem; margin-top: -1rem; }
	.largo { grid-column: 1 / -1; }
	.check { display: flex; gap: 0.5rem; align-items: center; font-weight: 400; margin-top: 0.75rem; }
	.mono { font-family: ui-monospace, monospace; font-size: 0.85rem; }
	.acoes { display: flex; flex-wrap: wrap; gap: 0.75rem 1rem; align-items: center; }
	.acoes button { margin: 1rem 0 0; }
	.acoes span { margin-top: 1rem; }
</style>
