import { imagemDe, type ImagemSuporte } from './imagens';
import { MAX_RESPOSTA_ABERTA, type Aberta, type Mc, type Resultado, type Vf } from './questao';

export type Estado = 'inativa' | 'antes' | 'no_prazo' | 'encerrada';

/** Prazo e situação são independentes: `ativa` é o interruptor manual, as datas fecham sozinhas. */
export function estadoAtividade(
	a: { ativa: boolean; abre_em: string | null; fecha_em: string | null },
	agora = Date.now()
): Estado {
	if (!a.ativa) return 'inativa';
	if (a.abre_em && agora < Date.parse(a.abre_em)) return 'antes';
	if (a.fecha_em && agora > Date.parse(a.fecha_em)) return 'encerrada';
	return 'no_prazo';
}

/** O menor entre início + tempo de prova e o fim do prazo da atividade (ISO), ou null se não houver limite. */
export function prazoDaTentativa(inicioMs: number, tempoTotalSeg: number | null, fechaEm: string | null): string | null {
	const limites: number[] = [];
	if (tempoTotalSeg) limites.push(inicioMs + tempoTotalSeg * 1000);
	if (fechaEm) limites.push(Date.parse(fechaEm));
	return limites.length ? new Date(Math.min(...limites)).toISOString() : null;
}

export const TOLERANCIA_MS = 5000;

export function expirou(prazoEm: string | null, acrescimoSeg: number, agora = Date.now()) {
	return prazoEm !== null && agora > Date.parse(prazoEm) + acrescimoSeg * 1000 + TOLERANCIA_MS;
}

const aleatorio = () => crypto.getRandomValues(new Uint32Array(1))[0] / 2 ** 32;

export function embaralhar<T>(lista: T[], rnd: () => number = aleatorio): T[] {
	const l = [...lista];
	for (let i = l.length - 1; i > 0; i--) {
		const j = Math.floor(rnd() * (i + 1));
		[l[i], l[j]] = [l[j], l[i]];
	}
	return l;
}

// ---------- cópia da questão guardada na tentativa ----------
/** `imagem_chave` existe só nas cópias antigas (uma imagem); as novas guardam `imagens`. */
/** Cópia do texto de apoio que a tentativa guarda (o da atividade, mostrado antes da questão 1). */
export type SuporteSnapshot = { titulo: string; texto: string; imagem_chave?: string | null; imagens?: import('./imagens').ImagemSuporte[] };

export type QuestaoSnapshot = {
	id: number;
	tipo: 'mc' | 'vf' | 'aberta';
	enunciado: string;
	config: Mc | Vf | Aberta; // MC já na ordem em que o aluno vê, com `correta` remapeada
	explicacao: string | null;
	pontos: number;
};

export type QuestaoAluno = Omit<QuestaoSnapshot, 'config' | 'explicacao'> & {
	/** Imagem da questão, abaixo do enunciado. */
	imagem: ImagemSuporte | null;
	config: { alternativas: string[] } | { afirmacoes: { texto: string }[] } | { max_chars: number; min_chars: number };
};

export function montarSnapshot(
	q: {
		id: number;
		tipo: string;
		enunciado: string;
		config: unknown;
		explicacao: string | null;
		pontos: number;
	},
	embaralharAlternativas: boolean,
	rnd?: () => number
): QuestaoSnapshot {
	let config = q.config as Mc | Vf;
	if (q.tipo === 'mc' && embaralharAlternativas) {
		const mc = config as Mc;
		const ordem = embaralhar(
			mc.alternativas.map((_, i) => i),
			rnd
		);
		config = { ...mc, alternativas: ordem.map((i) => mc.alternativas[i]), correta: ordem.indexOf(mc.correta) };
	}
	return {
		id: q.id,
		tipo: q.tipo as QuestaoSnapshot['tipo'],
		enunciado: q.enunciado,
		config,
		explicacao: q.explicacao,
		pontos: q.pontos
	};
}

/** O que o aluno pode receber: nunca o gabarito nem a explicação. */
export function versaoAluno(s: QuestaoSnapshot): QuestaoAluno {
	// questão aberta: a resposta de referência, os conceitos e a rubrica nunca saem do servidor
	const config =
		s.tipo === 'mc'
			? { alternativas: (s.config as Mc).alternativas }
			: s.tipo === 'aberta'
				? { max_chars: MAX_RESPOSTA_ABERTA, min_chars: (s.config as Aberta).min_chars }
				: { afirmacoes: (s.config as Vf).afirmacoes.map((a) => ({ texto: a.texto })) };
	return { id: s.id, tipo: s.tipo, enunciado: s.enunciado, pontos: s.pontos, imagem: imagemDe(s.config), config };
}

// ---------- validação de turmas e atividades ----------
export type TurmaValida = { nome: string; curso: string; periodo: string; ativa: boolean };

export function validarTurma(entrada: unknown): Resultado<TurmaValida> {
	const e = (entrada && typeof entrada === 'object' ? entrada : {}) as Record<string, unknown>;
	const t = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
	const erros: string[] = [];
	const nome = t(e.nome);
	if (!nome) erros.push('Informe o nome da turma.');
	if (nome.length > 100) erros.push('O nome da turma passa de 100 caracteres.');
	if (t(e.curso).length > 100 || t(e.periodo).length > 50) erros.push('Curso ou período longo demais.');
	if (erros.length) return { ok: false, erros };
	return { ok: true, valor: { nome, curso: t(e.curso), periodo: t(e.periodo), ativa: e.ativa !== false } };
}

export type Modo = 'treino' | 'prova';
export type Navegacao = 'livre' | 'sequencial';

export type AtividadeValida = {
	titulo: string;
	codigo: string | null;
	ativa: boolean;
	modo: Modo;
	/** segundos; null = sem limite */
	tempo_total: number | null;
	/** null = ilimitadas */
	tentativas_max: number | null;
	navegacao: Navegacao;
	embaralhar: boolean;
	/** só vale na Prova: mostra a nota ao aluno no final (nunca o gabarito) */
	mostra_nota: boolean;
	abre_em: string | null;
	fecha_em: string | null;
	/** Texto de apoio da atividade (aparece antes da questão 1); null = sem apoio. */
	suporte_id: number | null;
	questoes: { questao_id: number; pontos: number | null }[];
	turmas: number[];
};

/** Cada modo é uma predefinição das opções, ajustáveis uma a uma (a tela usa isto ao trocar de modo). */
export const PADROES_DO_MODO: Record<Modo, { tempo_min: number | null; tentativas_max: number | null; navegacao: Navegacao; embaralhar: boolean; mostra_nota: boolean }> = {
	treino: { tempo_min: null, tentativas_max: null, navegacao: 'livre', embaralhar: false, mostra_nota: false },
	prova: { tempo_min: 60, tentativas_max: 1, navegacao: 'livre', embaralhar: true, mostra_nota: false }
};

/** No Treino o gabarito vem logo após cada resposta; na Prova o aluno nunca recebe o gabarito. */
export const feedbackDoModo = (m: Modo) => (m === 'treino' ? ('imediato' as const) : ('nenhum' as const));

export const CODIGO_ATIVIDADE = /^[A-Za-z0-9-]{4,20}$/;
/** O link curto `/CODIGO` convive com estas rotas do sistema; elas não podem virar código de atividade. */
export const CODIGOS_RESERVADOS = ['admin', 'midia'];

const ALFABETO = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // sem I, L, O, 0, 1
export function gerarCodigo(tamanho = 6) {
	const b = crypto.getRandomValues(new Uint8Array(tamanho));
	return [...b].map((x) => ALFABETO[x % ALFABETO.length]).join('');
}

function data(v: unknown, nome: string, erros: string[]) {
	if (v === null || v === undefined || v === '') return null;
	const ms = typeof v === 'string' ? Date.parse(v) : NaN;
	if (Number.isNaN(ms)) {
		erros.push(`Data de ${nome} inválida.`);
		return null;
	}
	return new Date(ms).toISOString();
}

const vazio = (v: unknown) => v === null || v === undefined || v === '';

export function validarAtividade(entrada: unknown): Resultado<AtividadeValida> {
	const e = (entrada && typeof entrada === 'object' ? entrada : {}) as Record<string, unknown>;
	const erros: string[] = [];
	const titulo = typeof e.titulo === 'string' ? e.titulo.trim() : '';
	if (!titulo) erros.push('Informe o título.');
	if (titulo.length > 200) erros.push('O título passa de 200 caracteres.');

	const codigoBruto = typeof e.codigo === 'string' ? e.codigo.trim() : '';
	if (codigoBruto && !CODIGO_ATIVIDADE.test(codigoBruto)) erros.push('O código deve ter de 4 a 20 letras, números ou hífens.');
	else if (CODIGOS_RESERVADOS.includes(codigoBruto.toLowerCase())) erros.push('Este código é reservado pelo sistema. Escolha outro.');

	const modoBruto = e.modo ?? 'treino';
	if (modoBruto !== 'treino' && modoBruto !== 'prova') erros.push(modoBruto === 'ao_vivo' ? 'O modo Ao vivo ainda não está disponível.' : 'Modo inválido.');
	const modo: Modo = modoBruto === 'prova' ? 'prova' : 'treino';

	let tempo_total: number | null = null;
	if (!vazio(e.tempo_total_min)) {
		const min = Number(e.tempo_total_min);
		if (!Number.isInteger(min) || min < 1 || min > 600) erros.push('O tempo da atividade deve ser um número inteiro de minutos, de 1 a 600.');
		else tempo_total = min * 60;
	}

	// ausente = padrão do modo; null ou vazio = ilimitadas
	let tentativas_max: number | null = 'tentativas_max' in e ? null : PADROES_DO_MODO[modo].tentativas_max;
	if ('tentativas_max' in e && !vazio(e.tentativas_max)) {
		const n = Number(e.tentativas_max);
		if (!Number.isInteger(n) || n < 1 || n > 99) erros.push('O número de tentativas deve ser um inteiro de 1 a 99 (ou deixe ilimitado).');
		else tentativas_max = n;
	}

	const navegacao = e.navegacao ?? 'livre';
	if (navegacao !== 'livre' && navegacao !== 'sequencial') erros.push('Navegação inválida.');

	const abre_em = data(e.abre_em, 'abertura', erros);
	const fecha_em = data(e.fecha_em, 'prazo', erros);
	if (abre_em && fecha_em && Date.parse(fecha_em) <= Date.parse(abre_em)) erros.push('O prazo deve ser depois da abertura.');

	const lista = Array.isArray(e.questoes) ? e.questoes : [];
	const questoes = lista.map((x) => {
		const o = (x && typeof x === 'object' ? x : {}) as Record<string, unknown>;
		const pontos = o.pontos === null || o.pontos === undefined || o.pontos === '' ? null : Number(o.pontos);
		return { questao_id: Number(o.questao_id), pontos };
	});
	if (questoes.length < 1 || questoes.length > 100) erros.push('Escolha de 1 a 100 questões.');
	if (questoes.some((q) => !Number.isInteger(q.questao_id) || q.questao_id < 1)) erros.push('Questão inválida na lista.');
	if (new Set(questoes.map((q) => q.questao_id)).size !== questoes.length) erros.push('Há questão repetida na lista.');
	if (questoes.some((q) => q.pontos !== null && (!Number.isFinite(q.pontos) || q.pontos <= 0 || q.pontos > 100))) {
		erros.push('Os pontos de cada questão devem ser maiores que 0 e no máximo 100.');
	}

	const turmas = (Array.isArray(e.turmas) ? e.turmas : []).map(Number);
	if (turmas.length < 1 || turmas.length > 50) erros.push('Escolha ao menos uma turma.');
	if (turmas.some((t) => !Number.isInteger(t) || t < 1) || new Set(turmas).size !== turmas.length) erros.push('Turma inválida na lista.');

	let suporte_id: number | null = null;
	if (!vazio(e.suporte_id)) {
		suporte_id = Number(e.suporte_id);
		if (!Number.isInteger(suporte_id) || suporte_id < 1) {
			erros.push('Texto de apoio inválido.');
			suporte_id = null;
		}
	}

	if (erros.length) return { ok: false, erros };
	return {
		ok: true,
		valor: {
			titulo, codigo: codigoBruto || null, ativa: e.ativa !== false, modo, tempo_total, tentativas_max,
			navegacao: navegacao as Navegacao, embaralhar: e.embaralhar === true, mostra_nota: modo === 'prova' && e.mostra_nota === true,
			abre_em, fecha_em, suporte_id, questoes, turmas
		}
	};
}

// ---------- tentativa: dados do aluno ----------
export function validarInicio(entrada: unknown): Resultado<{ codigo: string; nome: string; turma_id: number; email: string }> {
	const e = (entrada && typeof entrada === 'object' ? entrada : {}) as Record<string, unknown>;
	const erros: string[] = [];
	const codigo = typeof e.codigo === 'string' ? e.codigo.trim() : '';
	const nome = typeof e.nome === 'string' ? e.nome.trim().replace(/\s+/g, ' ') : '';
	const email = typeof e.email === 'string' ? e.email.trim() : '';
	const turma_id = Number(e.turma_id);
	if (!codigo) erros.push('Código da atividade ausente.');
	if (nome.length < 2 || nome.length > 100) erros.push('Informe seu nome (de 2 a 100 caracteres).');
	if (!Number.isInteger(turma_id) || turma_id < 1) erros.push('Escolha sua turma.');
	if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 120) erros.push('Informe um e-mail válido.');
	if (erros.length) return { ok: false, erros };
	return { ok: true, valor: { codigo, nome, turma_id, email } };
}
