<script lang="ts">
	import { OPCOES_PROMPT_PADRAO, montarPromptIA, type OpcoesPrompt } from '#lib/importacao';

	let opcoes = $state<OpcoesPrompt>({ ...OPCOES_PROMPT_PADRAO, formatos: { ...OPCOES_PROMPT_PADRAO.formatos } });
	let copiado = $state(false);
	let campo: HTMLTextAreaElement | undefined = $state();
	const prompt = $derived(montarPromptIA(opcoes));

	async function copiar() {
		try {
			await navigator.clipboard.writeText(prompt);
		} catch {
			campo?.select(); // sem permissão da área de transferência: deixa tudo selecionado para Ctrl+C
			return;
		}
		copiado = true;
		setTimeout(() => (copiado = false), 2500);
	}
</script>

<div class="cartao">
	<div class="campos">
		<label class="largo">Tema ou conteúdo base <textarea bind:value={opcoes.tema} rows="3" placeholder="Ex.: Ciclo biológico do Plasmodium, ou cole aqui o texto da aula"></textarea></label>
		<label>Quantidade <input type="number" min="1" max="50" bind:value={opcoes.quantidade} /></label>
		<label>Nível
			<select bind:value={opcoes.nivel}>
				<option>fácil</option><option>médio</option><option>difícil</option><option>misto (fácil a difícil)</option>
			</select>
		</label>
		<label>Etiquetas (vírgula) <input bind:value={opcoes.etiquetas} placeholder="parasitologia, malária" /></label>
	</div>
	<fieldset>
		<legend>Formatos</legend>
		<label class="check"><input type="checkbox" bind:checked={opcoes.formatos.mc4} /> Múltipla escolha (4)</label>
		<label class="check"><input type="checkbox" bind:checked={opcoes.formatos.mc5} /> Múltipla escolha (5)</label>
		<label class="check"><input type="checkbox" bind:checked={opcoes.formatos.vf} /> Verdadeiro ou falso</label>
		<label class="check"><input type="checkbox" bind:checked={opcoes.formatos.aberta} /> Aberta (resposta escrita)</label>
		<label class="check"><input type="checkbox" bind:checked={opcoes.comApoio} /> Incluir texto de apoio</label>
	</fieldset>
	<label>Instrução pronta para a IA
		<textarea bind:this={campo} readonly rows="10" value={prompt} onfocus={(e) => e.currentTarget.select()} class="mono"></textarea>
	</label>
	<div class="acoes">
		<button type="button" onclick={copiar}>{copiado ? 'Instrução copiada ✔' : 'Copiar instrução'}</button>
		<span class="suave">Cole no ChatGPT, Claude, Gemini etc. e traga a resposta para o passo 2. <strong>Confira os gabaritos</strong>: a IA erra.</span>
	</div>
</div>

<style>
	.campos { display: grid; grid-template-columns: repeat(auto-fit, minmax(11rem, 1fr)); gap: 0 1rem; margin-top: -1rem; }
	.largo { grid-column: 1 / -1; }
	fieldset { margin: 1rem 0 0; padding: 0.5rem 1rem 0.75rem; border: 1px solid var(--borda); border-radius: 0.5rem; }
	legend { padding: 0 0.4rem; font-weight: 600; }
	.check { display: inline-flex; gap: 0.4rem; align-items: center; margin: 0.4rem 1rem 0 0; font-weight: 400; }
	.mono { font-family: ui-monospace, monospace; font-size: 0.85rem; }
	.acoes { display: flex; flex-wrap: wrap; gap: 0.75rem 1rem; align-items: center; }
	.acoes button { margin: 1rem 0 0; }
	.acoes span { margin-top: 1rem; }
</style>
