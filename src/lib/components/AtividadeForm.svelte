<script lang="ts">
	import { goto } from '$app/navigation';
	import { PADROES_DO_MODO, gerarCodigo, type Modo, type Navegacao } from '#lib/atividade';
	import { deInputLocal, paraInputLocal } from '#lib/data';
	import { protegerSaida } from '#lib/saida';
	import { untrack } from 'svelte';
	import CopiarLink from './CopiarLink.svelte';
	import SeletorSuporte from './SeletorSuporte.svelte';
	import SeletorQuestoes, { type Escolhida } from './SeletorQuestoes.svelte';

	type QuestaoSel = { questao_id: number; enunciado: string; tipo: string; pontos: number | null; pontos_padrao: number };
	type Inicial = {
		titulo: string; codigo: string; ativa: boolean; embaralhar: boolean; abre_em: string | null; fecha_em: string | null; questoes: QuestaoSel[]; turmas: number[];
		suporte_id?: number | null;
		modo: Modo; tempo_total: number | null; tentativas_max: number | null; navegacao: Navegacao; mostra_nota: boolean;
	};
	type Turma = { id: number; nome: string; ativa: boolean };

	let { id = null, inicial, turmasDisponiveis, suporteTitulo = '' }: { id?: number | null; inicial: Inicial; turmasDisponiveis: Turma[]; suporteTitulo?: string } = $props();

	const i0 = untrack(() => inicial);
	let titulo = $state(i0.titulo);
	let codigo = $state(i0.codigo || gerarCodigo());
	let ativa = $state(i0.ativa);
	let embaralhar = $state(i0.embaralhar);
	let modo = $state<Modo>(i0.modo);
	let tempoMin = $state<number | null>(i0.tempo_total ? Math.round(i0.tempo_total / 60) : null);
	let ilimitadas = $state(i0.tentativas_max === null);
	let tentativas = $state<number>(i0.tentativas_max ?? 1);
	let navegacao = $state<Navegacao>(i0.navegacao);
	let mostraNota = $state(i0.mostra_nota);

	/** Trocar de modo carrega a predefinição; depois cada opção continua ajustável. */
	function aplicarModo() {
		const p = PADROES_DO_MODO[modo];
		tempoMin = p.tempo_min;
		ilimitadas = p.tentativas_max === null;
		tentativas = p.tentativas_max ?? 1;
		navegacao = p.navegacao;
		embaralhar = p.embaralhar;
		mostraNota = p.mostra_nota;
	}
	let abre = $state(paraInputLocal(i0.abre_em));
	let fecha = $state(paraInputLocal(i0.fecha_em));
	let turmasSel = $state<number[]>([...i0.turmas]);
	let suporteId = $state<number | null>(i0.suporte_id ?? null);
	let questoes = $state<QuestaoSel[]>(i0.questoes.map((q) => ({ ...q })));
	let erros = $state<string[]>([]);
	let salvando = $state(false);
	const estadoAtual = () =>
		JSON.stringify([titulo, codigo, ativa, embaralhar, modo, tempoMin, ilimitadas, tentativas, navegacao, mostraNota, abre, fecha, turmasSel, suporteId, questoes.map((q) => [q.questao_id, q.pontos])]);
	const original = untrack(estadoAtual);
	let salvo = false;
	protegerSaida(() => !salvo && estadoAtual() !== original);

	const LIMITE_ATIVIDADE = 100;
	const selecionadas = $derived(new Set(questoes.map((q) => q.questao_id)));
	const turmasVisiveis = $derived(turmasDisponiveis.filter((t) => t.ativa || turmasSel.includes(t.id)));
	const totalPontos = $derived(questoes.reduce((s, q) => s + (q.pontos ?? q.pontos_padrao), 0));
	const vagas = $derived(Math.max(LIMITE_ATIVIDADE - questoes.length, 0));
	function adicionarEscolhidas(itens: Escolhida[]) {
		for (const q of itens) questoes.push({ questao_id: q.id, enunciado: q.enunciado, tipo: q.tipo, pontos: null, pontos_padrao: q.pontos });
	}
	function mover(i: number, d: -1 | 1) {
		const j = i + d;
		if (j < 0 || j >= questoes.length) return;
		[questoes[i], questoes[j]] = [questoes[j], questoes[i]];
	}
	const resumo = (t: string) => (t.length > 110 ? `${t.slice(0, 110)}…` : t);
	const formato = (t: string) => (t === 'vf' ? 'VF' : t === 'aberta' ? 'Aberta' : 'MC');

	async function salvar(e: SubmitEvent) {
		e.preventDefault();
		erros = [];
		salvando = true;
		try {
			const r = await fetch(id ? `/api/admin/atividades/${id}` : '/api/admin/atividades', {
				method: id ? 'PUT' : 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({
					titulo, codigo: codigo.trim(), ativa, embaralhar, modo, navegacao, mostra_nota: mostraNota,
					tempo_total_min: tempoMin, tentativas_max: ilimitadas ? null : tentativas,
					abre_em: deInputLocal(abre), fecha_em: deInputLocal(fecha),
					questoes: questoes.map((q) => ({ questao_id: q.questao_id, pontos: q.pontos })),
					turmas: turmasSel,
					suporte_id: suporteId
				})
			});
			const corpo = (await r.json().catch(() => ({}))) as { id?: number; erros?: string[] };
			if (!r.ok) erros = corpo.erros ?? ['Não foi possível salvar.'];
			else {
				salvo = true;
				if (id) await goto('/admin/atividades');
				else await goto(`/admin/atividades/${corpo.id}?criada=1`);
			}
		} catch {
			erros = ['Falha de conexão. Tente de novo.'];
		} finally {
			salvando = false;
		}
	}
</script>

<form onsubmit={salvar} class="cartao">
	<label>Título <input bind:value={titulo} required maxlength="200" placeholder="Revisão de parasitologia" /></label>

	<div class="bloco">
		<label for="codigo">Código e link para os alunos</label>
		<div class="linha">
			<span class="prefixo" aria-hidden="true">questplus.pages.dev/</span>
			<input id="codigo" bind:value={codigo} required minlength="4" maxlength="20" pattern="[A-Za-z0-9\-]+" autocomplete="off" spellcheck="false" />
			<button type="button" class="sec" onclick={() => (codigo = gerarCodigo())}>Sortear outro</button>
		</div>
		<p class="suave">Já vem sorteado. Pode trocar por um nome fácil (4 a 20 letras, números ou hífens), como <code>prova-parasito</code>. Maiúsculas e minúsculas valem igual.</p>
		{#if id && codigo.trim().length >= 4}<CopiarLink codigo={codigo.trim()} />{/if}
	</div>

	<fieldset>
		<legend>Turmas que podem responder</legend>
		{#if turmasVisiveis.length === 0}
			<p class="suave">Nenhuma turma ativa. <a href="/admin/turmas">Cadastre uma turma</a> primeiro.</p>
		{/if}
		{#each turmasVisiveis as t (t.id)}
			<label class="check"><input type="checkbox" value={t.id} bind:group={turmasSel} /> {t.nome}{t.ativa ? '' : ' (inativa)'}</label>
		{/each}
	</fieldset>

	<div class="duas">
		<label>Abre em (opcional) <input type="datetime-local" bind:value={abre} /></label>
		<label>Prazo final (opcional) <input type="datetime-local" bind:value={fecha} /></label>
	</div>
	<p class="suave">Sem datas, a atividade fica aberta enquanto estiver ativa. Quem estiver respondendo quando o prazo acabar é encerrado nesse momento. Horário do seu navegador.</p>

	<fieldset>
		<legend>Modo</legend>
		<label class="check"><input type="radio" name="modo" value="treino" bind:group={modo} onchange={aplicarModo} /> <span><strong>Treino</strong> — estudo e revisão: o aluno vê gabarito e explicação logo após cada resposta.</span></label>
		<label class="check"><input type="radio" name="modo" value="prova" bind:group={modo} onchange={aplicarModo} /> <span><strong>Prova</strong> — avaliação: o aluno <strong>nunca</strong> vê o gabarito; as respostas são salvas automaticamente.</span></label>
		<p class="suave">Ao trocar de modo, as opções abaixo voltam ao padrão dele; você pode ajustar cada uma. Alterar o modo com alunos respondendo afeta quem ainda não terminou.</p>

		<div class="duas">
			<label>Tempo total (minutos) <input type="number" min="1" max="600" step="1" bind:value={tempoMin} placeholder="Sem limite" /></label>
			<label>Navegação
				<select bind:value={navegacao}>
					<option value="livre">Livre (pode voltar às questões)</option>
					<option value="sequencial">Sequencial (uma vez, sem voltar)</option>
				</select>
			</label>
		</div>
		<p class="suave">O tempo conta a partir do clique em Começar, é medido no servidor e nunca passa do prazo final da atividade.</p>

		<div class="tent">
			<span class="rotulo">Tentativas por aluno</span>
			<label class="check"><input type="checkbox" bind:checked={ilimitadas} /> Ilimitadas</label>
			{#if !ilimitadas}
				<label class="num">Máximo de tentativas <input type="number" min="1" max="99" step="1" bind:value={tentativas} required /></label>
			{/if}
			<p class="suave">O aluno é identificado pelo e-mail. Se a conexão cair e ele ficar sem tentativa, anule a tentativa dele em <em>Ver tentativas</em> para liberar outra.</p>
		</div>

		{#if modo === 'prova'}
			<label class="check"><input type="checkbox" bind:checked={mostraNota} /> Mostrar a <strong>nota</strong> ao aluno no final (o gabarito nunca é mostrado)</label>
		{/if}
		<label class="check"><input type="checkbox" bind:checked={embaralhar} /> Embaralhar a ordem das questões e das alternativas a cada aluno</label>
	</fieldset>

	<label class="check"><input type="checkbox" bind:checked={ativa} /> Atividade ativa (interruptor manual; inativa, o código não abre)</label>

	<SeletorSuporte bind:valor={suporteId} tituloInicial={suporteTitulo} />

	<fieldset>
		<legend>Questões ({questoes.length}) · {totalPontos} pontos</legend>
		{#if questoes.length === 0}<p class="suave">Adicione questões pela busca abaixo.</p>{/if}
		<ol class="lista">
			{#each questoes as q, i (q.questao_id)}
				<li>
					<div class="texto"><span class="tag">{formato(q.tipo)}</span> {resumo(q.enunciado)}</div>
					<label class="pts">Pontos <input type="number" min="0.5" max="100" step="0.5" placeholder={String(q.pontos_padrao)} bind:value={q.pontos} /></label>
					<div class="mov">
						<button type="button" class="sec" disabled={i === 0} onclick={() => mover(i, -1)} aria-label="Subir">↑</button>
						<button type="button" class="sec" disabled={i === questoes.length - 1} onclick={() => mover(i, 1)} aria-label="Descer">↓</button>
						<button type="button" class="sec" onclick={() => questoes.splice(i, 1)}>Remover</button>
					</div>
				</li>
			{/each}
		</ol>

		<SeletorQuestoes {selecionadas} {vagas} onadicionar={adicionarEscolhidas} />
	</fieldset>

	{#if erros.length}<ul class="erro" role="alert">{#each erros as e}<li>{e}</li>{/each}</ul>{/if}

	<div class="acoes">
		<button type="submit" disabled={salvando}>{salvando ? 'Salvando…' : id ? 'Salvar alterações' : 'Criar atividade'}</button>
		<a href="/admin/atividades">Cancelar</a>
	</div>
</form>

<style>
	.bloco { margin-top: 1rem; }
	.bloco > label { margin-top: 0; }
	.linha { display: flex; flex-wrap: wrap; gap: 0.5rem; align-items: center; margin-top: 0.25rem; }
	.linha input { flex: 1; min-width: 8rem; margin: 0; font-family: ui-monospace, monospace; }
	.linha button { margin: 0; }
	.prefixo { color: var(--suave); font-family: ui-monospace, monospace; }
	fieldset { margin: 1rem 0 0; padding: 0.75rem 1rem 1rem; border: 1px solid var(--borda); border-radius: 0.5rem; }
	legend { padding: 0 0.4rem; font-weight: 600; }
	.check { display: flex; gap: 0.5rem; align-items: center; font-weight: 400; margin-top: 0.6rem; }
	.duas { display: grid; grid-template-columns: repeat(auto-fit, minmax(14rem, 1fr)); gap: 0 1rem; }
	.lista { padding: 0; margin: 0.5rem 0 0; list-style: none; }
	.lista li { display: flex; flex-wrap: wrap; gap: 0.5rem 1rem; align-items: center; justify-content: space-between; padding: 0.5rem 0; border-bottom: 1px solid var(--borda); }
	.texto { flex: 1 1 18rem; overflow-wrap: anywhere; }
	.tag { display: inline-block; padding: 0 0.4rem; font-size: 0.75rem; font-weight: 700; border: 1px solid var(--borda); border-radius: 0.3rem; }
	.pts { display: flex; gap: 0.4rem; align-items: center; margin: 0; font-weight: 400; }
	.pts input { width: 5rem; margin: 0; }
	.mov { display: flex; gap: 0.4rem; }
	.mov button { margin: 0; padding: 0.3rem 0.6rem; font-size: 0.85rem; }
	.acoes { display: flex; gap: 1rem; align-items: center; }
	.tent { margin-top: 1rem; }
	.rotulo { display: block; font-weight: 600; }
	.num { display: flex; gap: 0.5rem; align-items: center; margin-top: 0.4rem; }
	.num input { width: 6rem; margin: 0; }
</style>
