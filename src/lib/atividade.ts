import type { Mc, Resultado, Vf } from './questao';

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
export type SuporteSnapshot = { titulo: string; texto: string; imagem_chave: string | null };

export type QuestaoSnapshot = {
	id: number;
	tipo: 'mc' | 'vf';
	enunciado: string;
	config: Mc | Vf; // MC já na ordem em que o aluno vê, com `correta` remapeada
	explicacao: string | null;
	pontos: number;
	suporte: SuporteSnapshot | null;
};

export type QuestaoAluno = Omit<QuestaoSnapshot, 'config' | 'explicacao'> & {
	config: { alternativas: string[] } | { afirmacoes: { texto: string }[] };
};

export function montarSnapshot(
	q: {
		id: number;
		tipo: string;
		enunciado: string;
		config: unknown;
		explicacao: string | null;
		pontos: number;
		suporte: SuporteSnapshot | null;
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
		config = { alternativas: ordem.map((i) => mc.alternativas[i]), correta: ordem.indexOf(mc.correta) };
	}
	return {
		id: q.id,
		tipo: q.tipo as 'mc' | 'vf',
		enunciado: q.enunciado,
		config,
		explicacao: q.explicacao,
		pontos: q.pontos,
		suporte: q.suporte
	};
}

/** O que o aluno pode receber: nunca o gabarito nem a explicação. */
export function versaoAluno(s: QuestaoSnapshot): QuestaoAluno {
	const config =
		s.tipo === 'mc'
			? { alternativas: (s.config as Mc).alternativas }
			: { afirmacoes: (s.config as Vf).afirmacoes.map((a) => ({ texto: a.texto })) };
	return { id: s.id, tipo: s.tipo, enunciado: s.enunciado, pontos: s.pontos, suporte: s.suporte, config };
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

export type AtividadeValida = {
	titulo: string;
	codigo: string | null;
	ativa: boolean;
	embaralhar: boolean;
	abre_em: string | null;
	fecha_em: string | null;
	questoes: { questao_id: number; pontos: number | null }[];
	turmas: number[];
};

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

export function validarAtividade(entrada: unknown): Resultado<AtividadeValida> {
	const e = (entrada && typeof entrada === 'object' ? entrada : {}) as Record<string, unknown>;
	const erros: string[] = [];
	const titulo = typeof e.titulo === 'string' ? e.titulo.trim() : '';
	if (!titulo) erros.push('Informe o título.');
	if (titulo.length > 200) erros.push('O título passa de 200 caracteres.');

	const codigoBruto = typeof e.codigo === 'string' ? e.codigo.trim() : '';
	if (codigoBruto && !CODIGO_ATIVIDADE.test(codigoBruto)) erros.push('O código deve ter de 4 a 20 letras, números ou hífens.');
	else if (CODIGOS_RESERVADOS.includes(codigoBruto.toLowerCase())) erros.push('Este código é reservado pelo sistema. Escolha outro.');

	if (e.modo !== undefined && e.modo !== 'treino') erros.push('Por enquanto só o modo Treino está disponível.');

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

	if (erros.length) return { ok: false, erros };
	return {
		ok: true,
		valor: { titulo, codigo: codigoBruto || null, ativa: e.ativa !== false, embaralhar: e.embaralhar === true, abre_em, fecha_em, questoes, turmas }
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
