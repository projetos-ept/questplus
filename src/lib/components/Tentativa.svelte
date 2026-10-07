<script lang="ts">
	import { percentualDe } from '#lib/relatorio';
	import { onDestroy, onMount } from 'svelte';
	import { imagensDe, type ImagemSuporte } from '#lib/imagens';
	import { diagramas } from '#lib/diagramas';
	import { renderSuporte } from '#lib/suporte';
	import { formatarData } from '#lib/data';
	import FiguraQuestao from './FiguraQuestao.svelte';

	type Fb = { pontos: number; max: number; acertou: 'sim' | 'parcial' | 'nao'; gabarito: { correta: number } | { valores: boolean[] }; explicacao: string | null };
	type Q = {
		id: number; tipo: 'mc' | 'vf' | 'aberta'; enunciado: string; pontos: number; imagem?: ImagemSuporte | null;
		config: { alternativas?: string[]; afirmacoes?: { texto: string }[]; max_chars?: number; min_chars?: number };
	};
	type Estado = {
		id: number; status: 'andamento' | 'finalizada'; agora: string; prazo_em: string | null;
		atividade: { titulo: string; modo: 'treino' | 'prova'; feedback: 'imediato' | 'final' | 'nenhum'; navegacao: 'livre' | 'sequencial' };
		tentativas: { usadas: number; max: number | null };
		/** Texto de apoio da atividade (antes da questão 1); null = sem apoio. */
		suporte: { titulo: string; texto: string; imagem_chave?: string | null; imagens?: ImagemSuporte[] } | null;
		questoes: Q[]; respostas: Record<number, { resposta: { escolha?: number; valores?: (boolean | null)[]; texto?: string }; pendente?: boolean; feedback?: Fb }>;
		resultado: { nota: number; pontos_max: number; abertas_pendentes: number } | null;
	};

	type Regras = { modo: 'treino' | 'prova'; tempo_total: number | null; tentativas_max: number | null; mostra_nota: boolean };
	let { codigo, titulo, componente = null, turmas, fecha_em, regras }: { codigo: string; titulo: string; componente?: string | null; turmas: { id: number; nome: string }[]; fecha_em: string | null; regras: Regras } = $props();

	const CHAVE = $derived(`qp_t_${codigo.toLowerCase()}`);
	const LETRAS = ['A', 'B', 'C', 'D', 'E'];

	let fase = $state<'carregando' | 'inicio' | 'respondendo' | 'fim'>('carregando');
	let salva = $state<{ id: number; token: string } | null>(null);
	let estado = $state<Estado | null>(null);
	let atual = $state(0);
	// ao trocar de questão (grade, Anterior, Próxima) a página volta ao topo: sem isso o aluno cai no meio da questão nova
	let questaoVista = 0;
	$effect(() => {
		const i = atual;
		if (i !== questaoVista) {
			questaoVista = i;
			window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
		}
	});
	let rascunho = $state<Record<number, number | string | null | (boolean | null)[]>>({});
	let erro = $state('');
	let ocupado = $state(false);
	let nome = $state('');
	let turmaId = $state<number | null>(null);
	let email = $state('');
	let restante = $state<number | null>(null);
	let relogio: ReturnType<typeof setInterval> | undefined;
	let deslocamento = 0;

	const q = $derived(estado?.questoes[atual]);
	const resp = $derived(q && estado ? estado.respostas[q.id] : undefined);
	const imediato = $derived(estado?.atividade.feedback === 'imediato');
	const travada = $derived(!!resp && imediato);
	/** Treino: todas as questões com pontuação máxima. */
	const tudoCerto = $derived(!!estado?.resultado && estado.resultado.pontos_max > 0 && estado.resultado.nota >= estado.resultado.pontos_max);
	/** Prova: tentativas que ainda restam (Infinity = ilimitadas). */
	const restantes = $derived(estado ? (estado.tentativas.max === null ? Infinity : Math.max(estado.tentativas.max - estado.tentativas.usadas, 0)) : 0);
	/** Questão só conta como respondida com tudo marcado: V ou F com afirmação em branco fica "incompleta". */
	const completa = (id: number) => {
		const r = estado?.respostas[id]?.resposta;
		return !!r && (r.texto !== undefined ? r.texto.trim().length > 0 : r.valores ? r.valores.every((x) => x !== null) : r.escolha !== undefined && r.escolha !== null);
	};
	const respondidas = $derived(estado ? estado.questoes.filter((x) => completa(x.id)).length : 0);

	async function api(caminho: string, metodo = 'GET', corpo?: unknown) {
		const r = await fetch(caminho, {
			method: metodo,
			headers: { 'content-type': 'application/json', ...(salva ? { 'x-tentativa-token': salva.token } : {}) },
			body: corpo === undefined ? undefined : JSON.stringify(corpo)
		});
		const j = (await r.json().catch(() => ({}))) as Record<string, unknown> & { erros?: string[] };
		return { ok: r.ok, status: r.status, j, mensagem: j.erros?.[0] ?? 'Não foi possível concluir. Tente de novo.' };
	}

	function guardar() {
		try { localStorage.setItem(CHAVE, JSON.stringify(salva)); } catch {}
	}
	function esquecer() {
		salva = null;
		try { localStorage.removeItem(CHAVE); } catch {}
	}

	function preparar(e: Estado) {
		estado = e;
		for (const x of e.questoes) {
			if (x.id in rascunho) continue;
			// o que já está salvo no servidor volta marcado na tela (recarregar a página não pode parecer que perdeu a resposta)
			const salvaNoServidor = e.respostas[x.id]?.resposta;
			rascunho[x.id] =
				x.tipo === 'aberta'
					? (salvaNoServidor?.texto ?? '')
					: x.tipo === 'mc'
					? (salvaNoServidor?.escolha ?? null)
					: salvaNoServidor?.valores
						? [...salvaNoServidor.valores]
						: Array(x.config.afirmacoes!.length).fill(null);
		}
		deslocamento = Date.parse(e.agora) - Date.now();
		clearInterval(relogio);
		restante = null;
		if (e.prazo_em && e.status === 'andamento') {
			const passo = () => {
				restante = Math.max(0, Date.parse(e.prazo_em!) - (Date.now() + deslocamento));
				if (restante === 0) { clearInterval(relogio); finalizar(true); }
			};
			passo();
			relogio = setInterval(passo, 1000);
		}
	}

	onMount(async () => {
		try {
			const bruto = localStorage.getItem(CHAVE);
			if (bruto) salva = JSON.parse(bruto);
		} catch {}
		if (salva) {
			const r = await api(`/api/tentativas/${salva.id}`);
			if (r.ok && (r.j as unknown as Estado).status === 'andamento') estado = r.j as unknown as Estado;
			else esquecer();
		}
		fase = 'inicio';
	});
	onDestroy(() => clearInterval(relogio));

	async function iniciar(e: SubmitEvent) {
		e.preventDefault();
		erro = '';
		ocupado = true;
		const r = await api('/api/tentativas', 'POST', { codigo, nome, turma_id: turmaId, email }).catch(() => null);
		if (!r?.ok) { erro = r?.mensagem ?? 'Falha de conexão. Tente de novo.'; ocupado = false; return; }
		salva = { id: r.j.id as number, token: r.j.token as string };
		guardar();
		rascunho = {};
		await abrir();
		ocupado = false;
	}

	async function abrir() {
		const r = await api(`/api/tentativas/${salva!.id}`);
		if (!r.ok) { erro = r.mensagem; return; }
		const e = r.j as unknown as Estado;
		preparar(e);
		atual = 0;
		fase = e.status === 'finalizada' ? 'fim' : 'respondendo';
	}

	async function enviarResposta(qid: number, silencioso: boolean) {
		const quest = estado?.questoes.find((x) => x.id === qid);
		if (!quest || !estado) return;
		const valor = $state.snapshot(rascunho[qid]);
		if (!silencioso) { erro = ''; ocupado = true; }
		const r = await api(`/api/tentativas/${estado.id}/respostas/${qid}`, 'PUT', { resposta: quest.tipo === 'aberta' ? { texto: valor } : quest.tipo === 'mc' ? { escolha: valor } : { valores: valor } }).catch(() => null);
		ocupado = false;
		if (!r?.ok) {
			erro = r?.mensagem ?? 'Falha de conexão. Sua resposta não foi enviada.';
			if (r?.status === 409) await recarregar();
			return;
		}
		erro = '';
		estado.respostas[qid] = {
			resposta: quest.tipo === 'aberta' ? { texto: String(valor).trim() } : quest.tipo === 'mc' ? { escolha: valor as number } : { valores: valor as (boolean | null)[] },
			...(quest.tipo === 'aberta' && { pendente: true }),
			feedback: r.j.feedback as Fb | undefined
		};
	}

	const responder = () => (q ? enviarResposta(q.id, false) : undefined);

	// Na Prova não há botão "Responder": cada mudança é salva sozinha, e ninguém perde uma resposta ao trocar de questão.
	let pendente: Promise<void> | undefined;
	let agendado: ReturnType<typeof setTimeout> | undefined;
	let agendadoQ = 0;
	function valida(qid: number) {
		const quest = estado?.questoes.find((x) => x.id === qid);
		const v = rascunho[qid];
		if (quest?.tipo === 'aberta') return typeof v === 'string' && v.trim().length > 0;
		return !!quest && (quest.tipo === 'mc' ? v !== null && v !== undefined : Array.isArray(v) && v.some((x) => x !== null));
	}
	function aoMudar(ms = 300) {
		if (imediato || !q) return;
		const qid = q.id;
		clearTimeout(agendado);
		agendadoQ = qid;
		// espera o bind:group atualizar o rascunho antes de ler o valor
		agendado = setTimeout(() => {
			agendado = undefined;
			if (valida(qid)) pendente = enviarResposta(qid, true);
		}, ms);
	}
	async function descarregar() {
		if (agendado !== undefined) {
			clearTimeout(agendado);
			agendado = undefined;
			if (valida(agendadoQ)) pendente = enviarResposta(agendadoQ, true);
		}
		await pendente;
	}

	async function recarregar() {
		const r = await api(`/api/tentativas/${salva!.id}`);
		if (r.ok) {
			rascunho = {};
			const e = r.j as unknown as Estado;
			preparar(e);
			if (e.status === 'finalizada') fase = 'fim';
		}
	}

	async function finalizar(automatico = false) {
		if (!estado) return;
		await descarregar();
		if (!automatico) {
			const faltam = estado.questoes.length - respondidas;
			if (faltam > 0 && !confirm(`Você deixou ${faltam} questão(ões) sem resposta completa (inclui as com alguma afirmação em branco). Finalizar mesmo assim?`)) return;
		}
		ocupado = true;
		const r = await api(`/api/tentativas/${estado.id}/finalizar`, 'POST').catch(() => null);
		ocupado = false;
		if (!r?.ok) { erro = r?.mensagem ?? 'Falha de conexão ao finalizar.'; return; }
		clearInterval(relogio);
		clearTimeout(agendado);
		restante = null;
		estado = r.j as unknown as Estado;
		esquecer();
		fase = 'fim';
		atual = 0;
	}

	function novaTentativa() {
		estado = null; rascunho = {}; atual = 0; erro = ''; fase = 'inicio';
	}

	const pode = $derived.by(() => {
		if (!q || travada) return false;
		const v = rascunho[q.id];
		if (q.tipo === 'aberta') return typeof v === 'string' && v.trim().length > 0;
		if (q.tipo === 'mc') return v !== null && v !== undefined;
		return Array.isArray(v) && (imediato ? v.every((x) => x !== null) : v.some((x) => x !== null));
	});
	/** Aviso de tempo na Prova: aparece uma vez em cada limite (5 min e 1 min), para quem não está olhando o relógio. */
	const avisoTempo = $derived(restante === null || restante <= 0 ? '' : restante <= 60_000 ? 'Falta menos de 1 minuto.' : restante <= 300_000 ? 'Faltam menos de 5 minutos.' : '');
	const relogioTexto = $derived(restante === null ? '' : `${String(Math.floor(restante / 60000)).padStart(2, '0')}:${String(Math.floor(restante / 1000) % 60).padStart(2, '0')}`);
	const rotulo = (f: Fb) => (f.acertou === 'sim' ? '✔ Correta' : f.acertou === 'parcial' ? '◐ Parcialmente correta' : '✘ Incorreta');
	const pts = (n: number) => String(Math.round(n * 100) / 100).replace('.', ',');
</script>

<!-- na Prova, fechar ou recarregar a aba no meio faz o aluno perder tempo: o navegador pergunta antes -->
<svelte:window onbeforeunload={(e) => { if (fase === 'respondendo' && estado?.atividade.modo === 'prova') e.preventDefault(); }} />

{#if fase === 'carregando'}
	<p class="suave" aria-busy="true">Carregando…</p>

{:else if fase === 'inicio'}
	<h1>{titulo}</h1>
	{#if componente}<p class="componente">{componente}</p>{/if}
	{#if fecha_em}<p class="suave">Disponível até {formatarData(fecha_em)}.</p>{/if}
	<div class="cartao regras">
		<strong>Instruções:</strong>
		<ul>
			<li>{regras.tempo_total ? `Tempo: ${Math.round(regras.tempo_total / 60)} minutos, contados a partir do clique em Começar.` : 'Sem limite de tempo.'}</li>
			<li>{regras.tentativas_max ? `Tentativas: ${regras.tentativas_max}.` : 'Tentativas ilimitadas.'}</li>
			{#if regras.modo === 'prova'}
				<li>O gabarito não será mostrado. {regras.mostra_nota ? 'Você verá sua nota ao final.' : 'A nota será divulgada pelo professor.'}</li>
			{:else}
				<li>Gabarito e explicação aparecem logo depois de cada resposta.</li>
			{/if}
		</ul>
	</div>

	{#if estado && salva}
		<div class="cartao">
			<p><strong>Você tem uma tentativa em andamento.</strong></p>
			<button type="button" onclick={abrir}>Continuar de onde parei</button>
		</div>
		<p class="suave">Ou comece uma nova tentativa abaixo.</p>
	{/if}

	<form onsubmit={iniciar}>
		<label>Seu nome <input bind:value={nome} required minlength="2" maxlength="100" autocomplete="name" /></label>
		<label>Sua turma
			<select bind:value={turmaId} required>
				<option value={null} disabled selected>Escolha…</option>
				{#each turmas as t}<option value={t.id}>{t.nome}</option>{/each}
			</select>
		</label>
		<label>Seu e-mail <input type="email" bind:value={email} required maxlength="120" autocomplete="email" inputmode="email" /></label>
		<p class="suave aviso">Seu nome, turma e e-mail são usados apenas para o professor identificar suas respostas. Não é criada conta, e o e-mail não é verificado nem usado para login.</p>
		{#if erro}<p class="erro" role="alert">{erro}</p>{/if}
		<button type="submit" disabled={ocupado}>{ocupado ? 'Entrando…' : 'Começar'}</button>
	</form>

{:else if fase === 'respondendo' && estado && q}
	<!-- "caderno de prova": painel lateral (identificação, tempo, grade de questões) + folha da questão; no celular o painel vira uma faixa fixa no topo e as ações ficam fixas embaixo -->
	<div class="caderno">
		<aside class="lateral">
			<div class="ident">
				<strong class="atv">{titulo}</strong>
				{#if componente}<span class="comp">{componente}</span>{/if}
			</div>
			{#if restante !== null}
				<div class="tempo"><small>Tempo restante</small><span class="relogio" aria-label="Tempo restante" role="timer">⏱ {relogioTexto}</span></div>
			{/if}
			<div class="grade">
				<p class="barra"><span>Questão {atual + 1} de {estado.questoes.length}</span></p>
				{#if estado.atividade.navegacao === 'livre'}
					<nav class="pontos" aria-label="Questões">
						{#each estado.questoes as x, i (x.id)}
							<button type="button" class="sec" class:feita={completa(x.id)} aria-current={i === atual} aria-label="Questão {i + 1}{completa(x.id) ? ', respondida' : estado.respostas[x.id] ? ', incompleta' : ''}" onclick={() => (atual = i)}>
								{i + 1}{completa(x.id) ? '✔' : estado.respostas[x.id] ? '◐' : ''}
							</button>
						{/each}
					</nav>
				{/if}
				<p class="respondidas">{respondidas} de {estado.questoes.length} respondidas</p>
				<div class="progresso" role="progressbar" aria-label="Progresso da atividade" aria-valuemin="1" aria-valuemax={estado.questoes.length} aria-valuenow={atual + 1} aria-valuetext="Questão {atual + 1} de {estado.questoes.length}">
					<div class="preenchido" style="width: {((atual + 1) / estado.questoes.length) * 100}%"></div>
				</div>
			</div>
			{#if avisoTempo}<p class="aviso-tempo" role="status">⏱ {avisoTempo}</p>{/if}
		</aside>

		<div class="principal">
			{#key q.id}
				<section class="questao folha">
					<!-- o texto de apoio é da atividade: aberto antes da questão 1 e recolhido (para reler) nas outras -->
					{#if estado.suporte}
						{#if atual === 0}
							<div class="suporte cartao">
								<strong>Texto de apoio: {estado.suporte.titulo}</strong>
								<div class="md" use:diagramas={estado.suporte.texto}>{@html renderSuporte(estado.suporte.texto, imagensDe(estado.suporte)).html}</div>
							</div>
						{:else}
							<details class="suporte cartao reler">
								<summary>📄 Reler o texto de apoio: {estado.suporte.titulo}</summary>
								<div class="md" use:diagramas={estado.suporte.texto}>{@html renderSuporte(estado.suporte.texto, imagensDe(estado.suporte)).html}</div>
							</details>
						{/if}
					{/if}

					<div class="q"><span class="num" aria-hidden="true">{atual + 1}</span><p class="enunciado">{q.enunciado}</p></div>
			<FiguraQuestao imagem={q.imagem} />
			<p class="suave">{pts(q.pontos)} ponto{q.pontos === 1 ? '' : 's'}</p>

			{#if q.tipo === 'mc'}
				<div role="radiogroup" aria-label="Alternativas">
					{#each q.config.alternativas! as texto, i}
						{@const gab = resp?.feedback && 'correta' in resp.feedback.gabarito ? resp.feedback.gabarito.correta : null}
						<label class="op" class:certa={gab === i} class:minha={resp?.resposta.escolha === i && gab !== i && !!resp?.feedback}>
							<input type="radio" name="q{q.id}" value={i} bind:group={rascunho[q.id] as number | null} disabled={travada || ocupado} onchange={() => aoMudar()} />
							<span class="letra">{LETRAS[i]})</span>
							<span class="t">{texto}</span>
							{#if gab === i}<span class="sel">✔ Gabarito</span>{/if}
							{#if resp?.resposta.escolha === i && gab !== i && resp.feedback}<span class="sel">✘ Sua resposta</span>{/if}
							<span class="bolha" aria-hidden="true"></span>
						</label>
					{/each}
				</div>
			{:else if q.tipo === 'aberta'}
				{@const max = q.config.max_chars ?? 1200}
				{@const min = q.config.min_chars ?? 0}
				{@const texto = String(rascunho[q.id] ?? '')}
				{@const curta = min > 0 && texto.trim().length > 0 && texto.trim().length < min}
				<div class="aberta">
					<label for="aberta-{q.id}" class="suave">Escreva sua resposta com suas palavras.</label>
					<textarea id="aberta-{q.id}" rows="7" maxlength={max} bind:value={rascunho[q.id] as string} disabled={travada || ocupado} oninput={() => aoMudar(1200)} onblur={() => aoMudar(0)}></textarea>
					<p class="suave contador">{texto.length} de {max} caracteres{#if min > 0} · mínimo {min}{/if}</p>
					{#if curta}<p class="alerta-curta" role="alert">⚠ Resposta muito curta: respostas com menos de {min} caracteres podem não ser pontuadas. Faltam {min - texto.trim().length}.</p>{/if}
				</div>
			{:else}
				<div class="vf">
					{#each q.config.afirmacoes! as af, i}
						{@const gab = resp?.feedback && 'valores' in resp.feedback.gabarito ? resp.feedback.gabarito.valores[i] : null}
						{@const dada = resp?.resposta.valores?.[i]}
						<fieldset class="afirm">
							<legend>{af.texto}</legend>
							<label class="vfop"><input type="radio" name="q{q.id}a{i}" value={true} bind:group={(rascunho[q.id] as (boolean | null)[])[i]} disabled={travada || ocupado} onchange={() => aoMudar()} /> Verdadeiro</label>
							<label class="vfop"><input type="radio" name="q{q.id}a{i}" value={false} bind:group={(rascunho[q.id] as (boolean | null)[])[i]} disabled={travada || ocupado} onchange={() => aoMudar()} /> Falso</label>
							{#if resp?.feedback && gab !== null}
								<span class="sel">{dada === gab ? '✔ Acertou' : '✘ Errou'} — gabarito: {gab ? 'Verdadeiro' : 'Falso'}</span>
							{/if}
						</fieldset>
					{/each}
				</div>
			{/if}

			{#if q.tipo === 'aberta' && resp && imediato}
				<p class="suave" role="status">✔ Resposta enviada. O professor vai corrigir esta questão.</p>
			{:else if resp?.feedback}
				<div class="feedback cartao" role="status">
					<strong>{rotulo(resp.feedback)}</strong> · {pts(resp.feedback.pontos)} de {pts(resp.feedback.max)} ponto(s)
					{#if resp.feedback.explicacao}<p class="explic"><em>Explicação:</em> {resp.feedback.explicacao}</p>{/if}
				</div>
			{:else if resp}
				<p class="suave" role="status">✔ Resposta salva. Você pode mudá-la até finalizar.</p>
			{:else if !imediato}
				<p class="suave">As respostas são salvas automaticamente.</p>
			{/if}

			{#if erro}<p class="erro" role="alert">{erro}</p>{/if}

			<div class="acoes">
				{#if imediato && !travada}<button type="button" onclick={responder} disabled={!pode || ocupado}>{ocupado ? 'Enviando…' : 'Responder'}</button>{/if}
				{#if estado.atividade.navegacao === 'livre' && atual > 0}<button type="button" class="sec" onclick={() => (atual -= 1)}>Anterior</button>{/if}
				{#if atual < estado.questoes.length - 1}
					<button type="button" onclick={() => (atual += 1)} disabled={estado.atividade.navegacao === 'sequencial' && !resp}>Próxima</button>
				{/if}
			</div>
				</section>
			{/key}

			<div class="finalizar">
				<button type="button" class="sec" onclick={() => finalizar()} disabled={ocupado}>Finalizar atividade ({respondidas} de {estado.questoes.length} respondidas)</button>
			</div>
		</div>
	</div>

{:else if fase === 'fim' && estado}
	<h1>Atividade finalizada</h1>
	<p class="obrigado">Obrigado por participar! 🙌</p>
	{#if estado.resultado}
		<div class="cartao resultado" role="status">
			Você fez <strong>{pts(estado.resultado.nota)} de {pts(estado.resultado.pontos_max)} pontos</strong>{#if estado.resultado.abertas_pendentes > 0}&nbsp;(parcial){/if}. Seu percentual de rendimento foi de <strong>{String(percentualDe(estado.resultado.nota, estado.resultado.pontos_max)).replace('.', ',')}%</strong>.
			{#if estado.resultado.abertas_pendentes > 0}<p class="suave">{estado.resultado.abertas_pendentes} questão(ões) aberta(s) ainda serão corrigidas pelo professor; a nota final pode mudar.</p>{/if}
		</div>
	{:else}
		<p>Suas respostas foram enviadas.</p>
	{/if}

	{#if estado.atividade.modo === 'treino'}
		<div class="cartao incentivo" role="status">
			{#if tudoCerto}
				<strong>Parabéns!</strong> Você acertou todas as questões. Se quiser, refaça para fixar ainda mais.
			{:else}
				<strong>Continue praticando!</strong> Refaça a atividade quantas vezes quiser, até acertar todas as questões.
			{/if}
		</div>
	{:else if restantes > 0}
		<div class="cartao incentivo" role="status">
			{#if restantes === Infinity}
				Você pode fazer outra tentativa. <strong>Será considerada a maior nota.</strong>
			{:else}
				Você ainda tem <strong>{restantes} tentativa{restantes === 1 ? '' : 's'}</strong>. <strong>Será considerada a maior nota.</strong>
			{/if}
		</div>
	{:else}
		<div class="cartao incentivo" role="status">
			Você usou todas as tentativas. <strong>Aguarde o retorno detalhado da correção da prova pelo professor.</strong>
		</div>
	{/if}

	{#if estado.atividade.feedback === 'nenhum'}
		<p class="suave">O gabarito não é divulgado nesta atividade.</p>
	{:else if estado.resultado}
		<h2>Revisão</h2>
		<ol class="revisao">
			{#each estado.questoes as x (x.id)}
				{@const r = estado.respostas[x.id]}
				<li>
					<p class="enunciado">{x.enunciado}</p>
					<FiguraQuestao imagem={x.imagem} />
					{#if r?.feedback}
						<p><strong>{rotulo(r.feedback)}</strong> · {pts(r.feedback.pontos)} de {pts(r.feedback.max)}</p>
						{#if x.tipo === 'mc' && 'correta' in r.feedback.gabarito}
							<p class="suave">Sua resposta: {LETRAS[r.resposta.escolha ?? 0]}. Gabarito: {LETRAS[r.feedback.gabarito.correta]} — {x.config.alternativas![r.feedback.gabarito.correta]}</p>
						{/if}
						{#if r.feedback.explicacao}<p class="explic"><em>Explicação:</em> {r.feedback.explicacao}</p>{/if}
					{:else}
						<p class="suave">Sem resposta.</p>
					{/if}
				</li>
			{/each}
		</ol>
	{/if}
	{#if estado.atividade.modo === 'treino'}
		<button type="button" onclick={novaTentativa}>Refazer a atividade</button>
	{:else if restantes > 0}
		<button type="button" onclick={novaTentativa}>Fazer outra tentativa</button>
	{/if}
{/if}

<style>
	h1 { font-size: 1.4rem; }
	.aviso { font-size: 0.9rem; }
	.regras ul { margin: 0.4rem 0 0; padding-left: 1.2rem; }
	.aberta textarea { width: 100%; box-sizing: border-box; font: inherit; }
	.alerta-curta { margin: 0.35rem 0 0; padding: 0.5rem 0.75rem; font-weight: 600; color: var(--erro); border: 1px solid var(--erro); border-radius: 0.4rem; }
	.contador { margin: 0.25rem 0 0; text-align: right; font-size: 0.85rem; }
	.obrigado { font-size: 1.1rem; }
	.incentivo { margin: 1rem 0; border-color: var(--destaque); }
	.suporte { margin: 0.75rem 0; }
	.reler summary { cursor: pointer; font-weight: 600; }
	.md { overflow-wrap: anywhere; }
	.op .t { flex: 1; overflow-wrap: anywhere; }
	.sel { font-size: 0.85rem; font-weight: 700; }
	.afirm { margin: 0.6rem 0 0; padding: 0.6rem 0.75rem; background: var(--superficie); border: 1px solid var(--borda); border-radius: 0.5rem; }
	.afirm legend { padding: 0 0.3rem; font-weight: 600; overflow-wrap: anywhere; }
	.vfop { display: inline-flex; gap: 0.4rem; align-items: center; min-height: 2.75rem; margin: 0 1rem 0 0; font-weight: 400; }
	.feedback { margin-top: 1rem; }
	.explic { margin: 0.5rem 0 0; }
	.resultado { font-size: 1.1rem; }
	.revisao { padding-left: 1.2rem; }
	.revisao li { margin-bottom: 1.2rem; }

	/* ---------- caderno de prova ---------- */
	.caderno {
		--tinta: #1f3a5f;
		--sobre-tinta: #eef3fa;
		--marca: #a4402b;
		--marca-suave: #f6e3dc;
		--papel: var(--superficie);
		display: grid;
		grid-template-columns: 15.5rem minmax(0, 1fr);
		gap: 1.25rem;
		align-items: start;
		/* sai da coluna estreita da página para ter espaço para o painel */
		width: min(62rem, calc(100vw - 2rem));
		margin-left: calc(50% - min(31rem, 50vw - 1rem));
	}
	:global(:root[data-tema='escuro']) .caderno {
		--tinta: #16253b;
		--marca: #f0917a;
		--marca-suave: #3a2420;
	}
	.lateral { position: sticky; top: 1rem; display: flex; flex-direction: column; gap: 1rem; padding: 1.1rem 1rem; color: var(--sobre-tinta); background: var(--tinta); border-radius: 0.7rem; }
	.atv { display: block; line-height: 1.25; overflow-wrap: anywhere; }
	.comp { display: block; margin-top: 0.15rem; font-size: 0.85rem; opacity: 0.8; }
	.tempo { padding: 0.6rem 0.8rem; text-align: center; background: rgb(255 255 255 / 0.1); border-radius: 0.7rem; }
	.tempo small { display: block; font-size: 0.7rem; letter-spacing: 0.06em; text-transform: uppercase; opacity: 0.75; }
	.relogio { font-size: 1.4rem; font-weight: 800; font-variant-numeric: tabular-nums; }
	.barra { margin: 0 0 0.5rem; font-size: 0.85rem; font-weight: 600; opacity: 0.85; }
	.pontos { display: grid; grid-template-columns: repeat(5, 1fr); gap: 0.4rem; margin: 0; }
	.pontos button { min-width: 0; min-height: 2.6rem; margin: 0; padding: 0.1rem 0; font-weight: 700; color: var(--sobre-tinta); background: transparent; border: 1.5px solid rgb(255 255 255 / 0.35); border-radius: 0.6rem; }
	.pontos button.feita { color: #7ee2a8; border-color: #7ee2a8; }
	.pontos button[aria-current='true'] { color: var(--tinta); background: #fff; border-color: #fff; }
	.respondidas { margin: 0.6rem 0 0; font-size: 0.82rem; opacity: 0.8; }
	.progresso { height: 0.35rem; margin-top: 0.5rem; overflow: hidden; background: rgb(255 255 255 / 0.2); border-radius: 1rem; }
	.preenchido { height: 100%; background: #fff; border-radius: 1rem; transition: width 0.25s; }
	.aviso-tempo { margin: 0; padding: 0.4rem 0.7rem; font-weight: 700; color: #fff; background: var(--erro); border-radius: 0.5rem; }

	.folha { padding: 1.4rem clamp(1rem, 3vw, 2rem); background: var(--papel); border: 1px solid var(--borda); border-radius: 0.5rem; box-shadow: 0 2px 0 var(--borda); }
	.q { display: flex; gap: 1rem; align-items: flex-start; }
	.num { flex: none; font: 800 2.1rem/1 Georgia, serif; color: var(--marca); }
	.enunciado { margin: 0.15rem 0 0.25rem; font-size: 1.1rem; white-space: pre-wrap; overflow-wrap: anywhere; }
	[role='radiogroup'] { margin-top: 1rem; border-top: 1px dashed var(--borda); }
	.op { position: relative; display: grid; grid-template-columns: 2rem 1fr; grid-auto-flow: column; grid-auto-columns: auto; gap: 0.6rem; align-items: center; min-height: 3.4rem; padding: 0.7rem 0.5rem; margin: 0; font-weight: 400; background: transparent; border: 0; border-bottom: 1px dashed var(--borda); border-radius: 0; cursor: pointer; }
	.op:hover { background: rgb(128 128 128 / 0.07); }
	/* o rádio de verdade continua no lugar (teclado e leitor de tela), só some da vista */
	.op input { position: absolute; opacity: 0; width: 1px; height: 1px; }
	.op:has(input:focus-visible) { outline: 2px solid var(--destaque); outline-offset: -2px; }
	.op:has(input:checked) { background: var(--marca-suave); }
	.op .t { overflow-wrap: anywhere; }
	.letra { font-weight: 800; color: var(--suave); }
	.op:has(input:checked) .letra { color: var(--marca); }
	.bolha { width: 1.4rem; height: 1.4rem; border: 2px solid var(--suave); border-radius: 50%; }
	.op:has(input:checked) .bolha { border-color: var(--marca); background: radial-gradient(var(--marca) 45%, transparent 50%); }
	.certa { box-shadow: inset 0 0 0 2px var(--ok); }
	.minha { box-shadow: inset 0 0 0 2px var(--erro); }
	/* no computador as ações também acompanham a rolagem (no celular viram a barra fixa da base) */
	.acoes { position: sticky; bottom: 0; display: flex; flex-wrap: wrap; gap: 0.5rem; margin-top: 1.2rem; padding: 0.7rem 0; background: var(--papel); border-top: 1px solid var(--borda); }
	.acoes button, .finalizar button { min-height: 2.75rem; }
	.finalizar { margin-top: 1.25rem; padding-top: 1rem; border-top: 1px solid var(--borda); }

	@media (max-width: 760px) {
		.caderno { display: block; width: auto; margin-left: 0; padding-bottom: calc(5.5rem + env(safe-area-inset-bottom)); }
		/* faixa fixa no topo: título e tempo na primeira linha, grade de questões na segunda */
		.lateral { position: sticky; top: 0; z-index: 10; display: grid; grid-template-columns: 1fr auto; align-items: center; gap: 0.5rem 0.6rem; margin: 0 -1rem 0.75rem; padding: 0.6rem 1rem; border-radius: 0; box-shadow: 0 2px 10px rgb(0 0 0 / 0.25); }
		.ident { grid-column: 1; grid-row: 1; min-width: 0; font-size: 0.9rem; }
		.tempo { grid-column: 2; grid-row: 1; padding: 0.15rem 0.7rem; border-radius: 99px; }
		.tempo small { display: none; }
		.relogio { font-size: 1rem; }
		.grade { grid-column: 1 / -1; grid-row: 2; }
		.respondidas { display: none; }
		.barra { margin: 0 0 0.35rem; font-size: 0.78rem; }
		.pontos { gap: 0.35rem; }
		.pontos button { min-height: 2.4rem; }
		.progresso { margin-top: 0.4rem; }
		.aviso-tempo { grid-column: 1 / -1; grid-row: 3; text-align: center; }
		.folha { padding: 1rem 0.9rem; border-radius: 0.7rem; }
		.q .num { font-size: 1.8rem; }
		.op { min-height: 3.6rem; }
		/* ações fixas embaixo, ao alcance do polegar */
		.acoes { position: fixed; left: 0; right: 0; bottom: 0; z-index: 10; flex-wrap: nowrap; margin: 0; padding: 0.6rem 0.75rem calc(0.6rem + env(safe-area-inset-bottom)); background: var(--papel); border-top: 1px solid var(--borda); box-shadow: 0 -6px 16px rgb(0 0 0 / 0.15); }
		.acoes button { flex: 1; margin: 0; min-height: 3rem; }
	}
</style>
