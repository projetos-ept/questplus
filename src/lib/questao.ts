import { ehDisciplina } from './disciplinas';
import { imagemDe, imagensDe, validarImagemUnica, validarImagens, type ImagemSuporte } from './imagens';

/** `imagem`: uma imagem opcional, mostrada logo abaixo do enunciado e sempre centralizada. */
export type ComImagem = { imagem?: ImagemSuporte };
export type Mc = { alternativas: string[]; correta: number } & ComImagem;
export type Vf = { afirmacoes: { texto: string; valor: boolean }[] } & ComImagem;
/** Questão aberta, corrigida por rubrica (nível 0 a 4). `pontos_por_nivel` são percentuais da pontuação da questão. */
export type Aberta = {
	referencia: string;
	conceitos: { nome: string; sinonimos: string[] }[];
	oposicoes: [string, string][];
	min_chars: number;
	pontos_por_nivel: number[];
} & ComImagem;

export type QuestaoValida = {
	tipo: 'mc' | 'vf' | 'aberta';
	enunciado: string;
	config: Mc | Vf | Aberta;
	explicacao: string | null;
	pontos: number;
	suporte_id: number | null;
	etiquetas: string[];
	ativa: boolean;
};

export type Resultado<T> = { ok: true; valor: T } | { ok: false; erros: string[] };

const MAX_TEXTO = 4000;
const MAX_ITEM = 500;

const texto = (v: unknown) => (typeof v === 'string' ? v.trim() : '');

export function normalizarEtiquetas(v: unknown): string[] {
	const lista = Array.isArray(v) ? v : typeof v === 'string' ? v.split(',') : [];
	const vistas = new Set<string>();
	for (const e of lista) {
		const t = texto(e).toLowerCase();
		if (t) vistas.add(t);
	}
	return [...vistas];
}

export const MAX_RESPOSTA_ABERTA = 1200;
export const NIVEIS_PADRAO = [0, 25, 50, 75, 100];


function validarAberta(c: Record<string, unknown>): Resultado<Aberta> {
	const erros: string[] = [];
	const referencia = texto(c.referencia);
	if (!referencia) erros.push('Escreva a resposta de referência.');
	if (referencia.length > MAX_RESPOSTA_ABERTA) erros.push(`A resposta de referência passa de ${MAX_RESPOSTA_ABERTA} caracteres.`);

	const bruto = Array.isArray(c.conceitos) ? c.conceitos : [];
	const conceitos = bruto
		.map((x) => {
			const o = (x && typeof x === 'object' ? x : {}) as Record<string, unknown>;
			const sin = Array.isArray(o.sinonimos) ? o.sinonimos : typeof o.sinonimos === 'string' ? o.sinonimos.split(',') : [];
			return { nome: texto(o.nome), sinonimos: [...new Set(sin.map(texto).filter(Boolean))] };
		})
		.filter((x) => x.nome);
	if (conceitos.length < 1 || conceitos.length > 6) erros.push('Cadastre de 1 a 6 conceitos-chave (o ideal são 3 a 6).');
	if (conceitos.some((x) => x.nome.length > 100 || x.sinonimos.length > 10 || x.sinonimos.some((s) => s.length > 100))) {
		erros.push('Cada conceito tem até 100 caracteres e no máximo 10 sinônimos.');
	}

	const ops = Array.isArray(c.oposicoes) ? c.oposicoes : [];
	const oposicoes: [string, string][] = [];
	for (const par of ops) {
		const a = Array.isArray(par) ? [texto(par[0]), texto(par[1])] : [];
		if (a.length === 2 && a[0] && a[1]) oposicoes.push([a[0], a[1]]);
		else if (par !== null && par !== undefined && par !== '') erros.push('Cada par de oposição precisa de dois termos.');
	}
	if (oposicoes.length > 10 || oposicoes.some(([a, b]) => a.length > 60 || b.length > 60)) erros.push('Use até 10 pares de oposição de até 60 caracteres.');

	const min_chars = c.min_chars === undefined || c.min_chars === '' || c.min_chars === null ? 20 : Number(c.min_chars);
	if (!Number.isInteger(min_chars) || min_chars < 0 || min_chars > 500) erros.push('O mínimo de caracteres deve ser um número inteiro de 0 a 500.');

	const niveis = c.pontos_por_nivel === undefined || c.pontos_por_nivel === null ? NIVEIS_PADRAO : c.pontos_por_nivel;
	if (!Array.isArray(niveis) || niveis.length !== 5 || niveis.some((n) => typeof n !== 'number' || !Number.isFinite(n) || n < 0 || n > 100)) {
		erros.push('A tabela de pontos por nível precisa de 5 valores entre 0 e 100 (níveis 0 a 4).');
	} else if (niveis.some((n, i) => i > 0 && n < niveis[i - 1])) erros.push('A tabela de pontos não pode diminuir de um nível para o seguinte.');

	if (erros.length) return { ok: false, erros };
	return { ok: true, valor: { referencia, conceitos, oposicoes, min_chars, pontos_por_nivel: niveis as number[] } };
}

export function validarQuestao(entrada: unknown): Resultado<QuestaoValida> {
	const erros: string[] = [];
	const e = (entrada && typeof entrada === 'object' ? entrada : {}) as Record<string, unknown>;

	const tipo = e.tipo;
	if (tipo !== 'mc' && tipo !== 'vf' && tipo !== 'aberta') {
		return { ok: false, erros: ['Tipo de questão inválido ou ainda não disponível (use mc, vf ou aberta).'] };
	}

	const enunciado = texto(e.enunciado);
	if (!enunciado) erros.push('Informe o enunciado.');
	if (enunciado.length > MAX_TEXTO) erros.push(`O enunciado passa de ${MAX_TEXTO} caracteres.`);

	const explicacao = texto(e.explicacao) || null;
	if (explicacao && explicacao.length > MAX_TEXTO) erros.push(`A explicação passa de ${MAX_TEXTO} caracteres.`);

	const pontos = e.pontos === undefined || e.pontos === '' ? 1 : Number(e.pontos);
	if (!Number.isFinite(pontos) || pontos <= 0 || pontos > 100) erros.push('Os pontos devem ser maiores que 0 e no máximo 100.');

	let suporte_id: number | null = null;
	if (e.suporte_id !== null && e.suporte_id !== undefined && e.suporte_id !== '') {
		suporte_id = Number(e.suporte_id);
		if (!Number.isInteger(suporte_id) || suporte_id < 1) {
			erros.push('Texto de apoio inválido.');
			suporte_id = null;
		}
	}

	const etiquetas = normalizarEtiquetas(e.etiquetas);
	if (etiquetas.length > 10) erros.push('Use no máximo 10 etiquetas.');
	if (etiquetas.some((t) => t.length > 40)) erros.push('Cada etiqueta pode ter até 40 caracteres.');

	const c = (e.config && typeof e.config === 'object' ? e.config : {}) as Record<string, unknown>;
	let config: Mc | Vf | Aberta = { alternativas: [], correta: 0 };

	if (tipo === 'mc') {
		const alt = Array.isArray(c.alternativas) ? c.alternativas.map(texto) : [];
		if (alt.length !== 4 && alt.length !== 5) erros.push('Uma questão de múltipla escolha precisa de 4 ou 5 alternativas.');
		else if (alt.some((a) => !a)) erros.push('Preencha todas as alternativas.');
		else if (alt.some((a) => a.length > MAX_ITEM)) erros.push(`Cada alternativa pode ter até ${MAX_ITEM} caracteres.`);
		const correta = c.correta;
		if (typeof correta !== 'number' || !Number.isInteger(correta) || correta < 0 || correta >= alt.length) {
			erros.push('Marque exatamente uma alternativa correta.');
		}
		config = { alternativas: alt, correta: correta as number };
	} else if (tipo === 'aberta') {
		const r = validarAberta(c);
		if (r.ok) config = r.valor;
		else erros.push(...r.erros);
	} else {
		const af = Array.isArray(c.afirmacoes) ? c.afirmacoes : [];
		if (af.length < 1 || af.length > 10) erros.push('Use de 1 a 10 afirmações.');
		const afirmacoes = af.map((a) => {
			const o = (a && typeof a === 'object' ? a : {}) as Record<string, unknown>;
			return { texto: texto(o.texto), valor: o.valor as boolean };
		});
		if (afirmacoes.some((a) => !a.texto)) erros.push('Preencha o texto de todas as afirmações.');
		if (afirmacoes.some((a) => a.texto.length > MAX_ITEM)) erros.push(`Cada afirmação pode ter até ${MAX_ITEM} caracteres.`);
		if (afirmacoes.some((a) => typeof a.valor !== 'boolean')) erros.push('Marque verdadeiro ou falso em todas as afirmações.');
		config = { afirmacoes };
	}

	const img = validarImagemUnica(e.imagem ?? c.imagem);
	if (!img.ok) erros.push(...img.erros);
	else if (img.valor) config = { ...config, imagem: img.valor } as typeof config;

	if (erros.length) return { ok: false, erros };
	return {
		ok: true,
		valor: { tipo, enunciado, config, explicacao, pontos, suporte_id, etiquetas, ativa: e.ativa !== false }
	};
}

export function formatoDe(tipo: string, config: unknown): 'MC4' | 'MC5' | 'VF' | string {
	if (tipo === 'mc') return (config as Mc).alternativas.length === 5 ? 'MC5' : 'MC4';
	if (tipo === 'vf') return 'VF';
	if (tipo === 'aberta') return 'Aberta';
	return tipo;
}

/** Estado do formulário do painel (alternativas sempre com 5 campos; MC4 usa os 4 primeiros). */
export type Formulario = {
	formato: 'mc4' | 'mc5' | 'vf' | 'aberta';
	enunciado: string;
	alternativas: string[];
	correta: number | null;
	afirmacoes: { texto: string; valor: boolean }[];
	explicacao: string;
	pontos: number;
	suporte_id: number | null;
	etiquetas: string;
	/** Primeira etiqueta: disciplina do curso (ver disciplinas.ts). Vazia em questões antigas. */
	disciplina: string;
	/** Imagem opcional da questão (abaixo do enunciado). */
	imagem: ImagemSuporte | null;
	ativa: boolean;
	// questão aberta
	referencia: string;
	conceitos: { nome: string; sinonimos: string }[];
	oposicoes: { a: string; b: string }[];
	min_chars: number;
	niveis: number[];
};

export const formularioVazio = (): Formulario => ({
	formato: 'mc4',
	enunciado: '',
	alternativas: ['', '', '', '', ''],
	correta: null,
	afirmacoes: [{ texto: '', valor: true }],
	explicacao: '',
	pontos: 1,
	suporte_id: null,
	etiquetas: '',
	disciplina: '',
	imagem: null,
	ativa: true,
	referencia: '',
	conceitos: [{ nome: '', sinonimos: '' }, { nome: '', sinonimos: '' }, { nome: '', sinonimos: '' }],
	oposicoes: [],
	min_chars: 20,
	niveis: [...NIVEIS_PADRAO]
});

export function formularioDe(q: {
	tipo: string;
	enunciado: string;
	config: unknown;
	explicacao: string | null;
	pontos: number;
	suporte_id: number | null;
	etiquetas: string[];
	ativa: boolean;
}): Formulario {
	const f = formularioVazio();
	f.enunciado = q.enunciado;
	f.explicacao = q.explicacao ?? '';
	f.pontos = q.pontos;
	f.suporte_id = q.suporte_id;
	const primeira = q.etiquetas[0];
	f.disciplina = primeira && ehDisciplina(primeira) ? primeira : '';
	f.etiquetas = (f.disciplina ? q.etiquetas.slice(1) : q.etiquetas).join(', ');
	f.ativa = q.ativa;
	f.imagem = imagemDe(q.config);
	if (q.tipo === 'mc') {
		const c = q.config as Mc;
		f.formato = c.alternativas.length === 5 ? 'mc5' : 'mc4';
		f.alternativas = [...c.alternativas, '', '', '', '', ''].slice(0, 5);
		f.correta = c.correta;
	} else if (q.tipo === 'aberta') {
		const c = q.config as Aberta;
		f.formato = 'aberta';
		f.referencia = c.referencia;
		f.conceitos = c.conceitos.map((x) => ({ nome: x.nome, sinonimos: x.sinonimos.join(', ') }));
		f.oposicoes = c.oposicoes.map(([a, b]) => ({ a, b }));
		f.min_chars = c.min_chars;
		f.niveis = [...c.pontos_por_nivel];
	} else if (q.tipo === 'vf') {
		f.formato = 'vf';
		f.afirmacoes = (q.config as Vf).afirmacoes.map((a) => ({ ...a }));
	}
	return f;
}

export function entradaDe(f: Formulario) {
	const base = {
		enunciado: f.enunciado,
		explicacao: f.explicacao,
		pontos: f.pontos,
		suporte_id: f.suporte_id,
		etiquetas: [...new Set([...(f.disciplina ? [f.disciplina] : []), ...normalizarEtiquetas(f.etiquetas)])],
		imagem: f.imagem,
		ativa: f.ativa
	};
	if (f.formato === 'aberta') {
		return {
			...base,
			tipo: 'aberta',
			config: {
				referencia: f.referencia,
				conceitos: f.conceitos.map((x) => ({ nome: x.nome, sinonimos: x.sinonimos.split(',') })),
				oposicoes: f.oposicoes.filter((o) => o.a.trim() || o.b.trim()).map((o) => [o.a, o.b]),
				min_chars: f.min_chars,
				pontos_por_nivel: f.niveis
			}
		};
	}
	if (f.formato === 'vf') return { ...base, tipo: 'vf', config: { afirmacoes: f.afirmacoes } };
	const n = f.formato === 'mc5' ? 5 : 4;
	return { ...base, tipo: 'mc', config: { alternativas: f.alternativas.slice(0, n), correta: f.correta } };
}

export type Suporte = { titulo: string; texto: string; imagens: ImagemSuporte[] };

export { CHAVE_IMAGEM } from './imagens';

/** Aceita `imagens` (até 10) e, por compatibilidade, o campo antigo `imagem_chave` (uma imagem). */
export function validarSuporte(entrada: unknown): Resultado<Suporte> {
	const erros: string[] = [];
	const e = (entrada && typeof entrada === 'object' ? entrada : {}) as Record<string, unknown>;
	const titulo = texto(e.titulo);
	const corpo = typeof e.texto === 'string' ? e.texto.trim() : '';
	const legado = typeof e.imagem_chave === 'string' && e.imagem_chave ? e.imagem_chave : null;
	const bruto = e.imagens === undefined || e.imagens === null ? imagensDe({ imagem_chave: legado }) : e.imagens;
	const imgs = validarImagens(bruto);
	if (!titulo) erros.push('Informe o título.');
	if (titulo.length > 200) erros.push('O título passa de 200 caracteres.');
	if (corpo.length > 20000) erros.push('O texto passa de 20000 caracteres.');
	if (!imgs.ok) erros.push(...imgs.erros);
	if (!corpo && !(imgs.ok && imgs.valor.length)) erros.push('Informe um texto, uma imagem ou os dois.');
	if (erros.length) return { ok: false, erros };
	return { ok: true, valor: { titulo, texto: corpo, imagens: imgs.ok ? imgs.valor : [] } };
}
