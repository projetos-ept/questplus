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
	let { codigo, titulo, turmas, fecha_em, regras }: { codigo: string; titulo: string; turmas: { id: number; nome: string }[]; fecha_em: string | null; regras: Regras } = $props();

	const CHAVE = $derived(`qp_t_${codigo.toLowerCase()}`);
	const LETRAS = ['A', 'B', 'C', 'D', 'E'];

	let fase = $state<'carregando' | 'inicio' | 'respondendo' | 'fim'>('carregando');
	let salva = $state<{ id: number; token: string } | null>(null);
	let estado = $state<Estado | null>(null);
	let atual = $state(0);
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
	{#if fecha_em}<p class="suave">Disponível até {formatarData(fecha_em)}.</p>{/if}
	<div class="cartao regras">
		<strong>{regras.modo === 'prova' ? 'Prova' : 'Treino'}</strong>
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
	<header class="barra">
		<span>Questão {atual + 1} de {estado.questoes.length}</span>
		{#if restante !== null}<span class="relogio" aria-label="Tempo restante" role="timer">⏱ {relogioTexto}</span>{/if}
	</header>
	{#if avisoTempo}<p class="aviso-tempo" role="status">⏱ {avisoTempo}</p>{/if}
	<div class="progresso" role="progressbar" aria-label="Progresso da atividade" aria-valuemin="1" aria-valuemax={estado.questoes.length} aria-valuenow={atual + 1} aria-valuetext="Questão {atual + 1} de {estado.questoes.length}">
		<div class="preenchido" style="width: {((atual + 1) / estado.questoes.length) * 100}%"></div>
	</div>
	<p class="respondidas suave">{respondidas} de {estado.questoes.length} respondidas</p>

	{#if estado.atividade.navegacao === 'livre'}
		<nav class="pontos" aria-label="Questões">
			{#each estado.questoes as x, i (x.id)}
				<button type="button" class="sec" aria-current={i === atual} aria-label="Questão {i + 1}{completa(x.id) ? ', respondida' : estado.respostas[x.id] ? ', incompleta' : ''}" onclick={() => (atual = i)}>
					{i + 1}{completa(x.id) ? '✔' : estado.respostas[x.id] ? '◐' : ''}
				</button>
			{/each}
		</nav>
	{/if}

	{#key q.id}
		<section class="questao">
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

			<p class="enunciado">{q.enunciado}</p>
			<FiguraQuestao imagem={q.imagem} />
			<p class="suave">{pts(q.pontos)} ponto{q.pontos === 1 ? '' : 's'}</p>

			{#if q.tipo === 'mc'}
				<div role="radiogroup" aria-label="Alternativas">
					{#each q.config.alternativas! as texto, i}
						{@const gab = resp?.feedback && 'correta' in resp.feedback.gabarito ? resp.feedback.gabarito.correta : null}
						<label class="op" class:certa={gab === i} class:minha={resp?.resposta.escolha === i && gab !== i && !!resp?.feedback}>
							<input type="radio" name="q{q.id}" value={i} bind:group={rascunho[q.id] as number | null} disabled={travada || ocupado} onchange={() => aoMudar()} />
							<span class="letra">{LETRAS[i]}</span>
							<span class="t">{texto}</span>
							{#if gab === i}<span class="sel">✔ Gabarito</span>{/if}
							{#if resp?.resposta.escolha === i && gab !== i && resp.feedback}<span class="sel">✘ Sua resposta</span>{/if}
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
					<button type="button" class="sec" onclick={() => (atual += 1)} disabled={estado.atividade.navegacao === 'sequencial' && !resp}>Próxima</button>
				{/if}
			</div>
		</section>
	{/key}

	<div class="finalizar">
		<button type="button" class="sec" onclick={() => finalizar()} disabled={ocupado}>Finalizar atividade ({respondidas} de {estado.questoes.length} respondidas)</button>
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
	.barra { display: flex; justify-content: space-between; align-items: center; font-weight: 600; }
	.relogio { font-variant-numeric: tabular-nums; }
	.progresso { height: 0.6rem; margin-top: 0.5rem; overflow: hidden; background: var(--borda); border-radius: 1rem; }
	.preenchido { height: 100%; background: var(--destaque); border-radius: 1rem; transition: width 0.25s; }
	.aviso-tempo { margin: 0.5rem 0 0; padding: 0.4rem 0.7rem; font-weight: 700; border: 2px solid var(--erro); border-radius: 0.4rem; }
	.aberta textarea { width: 100%; box-sizing: border-box; font: inherit; }
	.alerta-curta { margin: 0.35rem 0 0; padding: 0.5rem 0.75rem; font-weight: 600; color: var(--erro); border: 1px solid var(--erro); border-radius: 0.4rem; }
	.contador { margin: 0.25rem 0 0; text-align: right; font-size: 0.85rem; }
	.respondidas { margin: 0.35rem 0 0; font-size: 0.85rem; }
	.obrigado { font-size: 1.1rem; }
	.incentivo { margin: 1rem 0; border-color: var(--destaque); }
	.pontos { display: flex; flex-wrap: wrap; gap: 0.4rem; margin: 0.75rem 0; }
	.pontos button { margin: 0; min-width: 2.75rem; min-height: 2.75rem; padding: 0.2rem 0.5rem; }
	.pontos button[aria-current='true'] { color: var(--sobre-destaque); background: var(--destaque); border-color: var(--destaque); }
	.suporte { margin: 0.75rem 0; }
	.reler summary { cursor: pointer; font-weight: 600; }
	.md { overflow-wrap: anywhere; }
	.enunciado { margin: 0.75rem 0 0.25rem; font-size: 1.05rem; white-space: pre-wrap; overflow-wrap: anywhere; }
	.op { display: flex; gap: 0.6rem; align-items: flex-start; min-height: 2.75rem; padding: 0.6rem 0.75rem; margin-top: 0.5rem; font-weight: 400; background: var(--superficie); border: 1px solid var(--borda); border-radius: 0.5rem; cursor: pointer; }
	.op input { margin-top: 0.3rem; flex: none; }
	.op .t { flex: 1; overflow-wrap: anywhere; }
	.letra { font-weight: 700; }
	.sel { font-size: 0.85rem; font-weight: 700; }
	.certa { border: 2px solid var(--ok); }
	.minha { border: 2px solid var(--erro); }
	.afirm { margin: 0.6rem 0 0; padding: 0.6rem 0.75rem; background: var(--superficie); border: 1px solid var(--borda); border-radius: 0.5rem; }
	.afirm legend { padding: 0 0.3rem; font-weight: 600; overflow-wrap: anywhere; }
	.vfop { display: inline-flex; gap: 0.4rem; align-items: center; min-height: 2.75rem; margin: 0 1rem 0 0; font-weight: 400; }
	.feedback { margin-top: 1rem; }
	.explic { margin: 0.5rem 0 0; }
	.acoes { display: flex; flex-wrap: wrap; gap: 0.5rem; }
	.acoes button, .finalizar button { min-height: 2.75rem; }
	.finalizar { margin-top: 1.5rem; padding-top: 1rem; border-top: 1px solid var(--borda); }
	.resultado { font-size: 1.1rem; }
	.revisao { padding-left: 1.2rem; }
	.revisao li { margin-bottom: 1.2rem; }
</style>
