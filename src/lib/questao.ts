export type Mc = { alternativas: string[]; correta: number };
export type Vf = { afirmacoes: { texto: string; valor: boolean }[] };

export type QuestaoValida = {
	tipo: 'mc' | 'vf';
	enunciado: string;
	config: Mc | Vf;
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

export function validarQuestao(entrada: unknown): Resultado<QuestaoValida> {
	const erros: string[] = [];
	const e = (entrada && typeof entrada === 'object' ? entrada : {}) as Record<string, unknown>;

	const tipo = e.tipo;
	if (tipo !== 'mc' && tipo !== 'vf') {
		return { ok: false, erros: ['Tipo de questão inválido ou ainda não disponível (use mc ou vf).'] };
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
	let config: Mc | Vf = { alternativas: [], correta: 0 };

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

	if (erros.length) return { ok: false, erros };
	return {
		ok: true,
		valor: { tipo, enunciado, config, explicacao, pontos, suporte_id, etiquetas, ativa: e.ativa !== false }
	};
}

export function formatoDe(tipo: string, config: unknown): 'MC4' | 'MC5' | 'VF' | string {
	if (tipo === 'mc') return (config as Mc).alternativas.length === 5 ? 'MC5' : 'MC4';
	if (tipo === 'vf') return 'VF';
	return tipo;
}

/** Estado do formulário do painel (alternativas sempre com 5 campos; MC4 usa os 4 primeiros). */
export type Formulario = {
	formato: 'mc4' | 'mc5' | 'vf';
	enunciado: string;
	alternativas: string[];
	correta: number | null;
	afirmacoes: { texto: string; valor: boolean }[];
	explicacao: string;
	pontos: number;
	suporte_id: number | null;
	etiquetas: string;
	ativa: boolean;
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
	ativa: true
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
	f.etiquetas = q.etiquetas.join(', ');
	f.ativa = q.ativa;
	if (q.tipo === 'mc') {
		const c = q.config as Mc;
		f.formato = c.alternativas.length === 5 ? 'mc5' : 'mc4';
		f.alternativas = [...c.alternativas, '', '', '', '', ''].slice(0, 5);
		f.correta = c.correta;
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
		etiquetas: normalizarEtiquetas(f.etiquetas),
		ativa: f.ativa
	};
	if (f.formato === 'vf') return { ...base, tipo: 'vf', config: { afirmacoes: f.afirmacoes } };
	const n = f.formato === 'mc5' ? 5 : 4;
	return { ...base, tipo: 'mc', config: { alternativas: f.alternativas.slice(0, n), correta: f.correta } };
}

export type Suporte = { titulo: string; texto: string; imagem_chave: string | null };

export const CHAVE_IMAGEM = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(png|jpg|webp|gif)$/;

export function validarSuporte(entrada: unknown): Resultado<Suporte> {
	const erros: string[] = [];
	const e = (entrada && typeof entrada === 'object' ? entrada : {}) as Record<string, unknown>;
	const titulo = texto(e.titulo);
	const corpo = typeof e.texto === 'string' ? e.texto.trim() : '';
	const imagem = e.imagem_chave === null || e.imagem_chave === undefined || e.imagem_chave === '' ? null : String(e.imagem_chave);
	if (!titulo) erros.push('Informe o título.');
	if (titulo.length > 200) erros.push('O título passa de 200 caracteres.');
	if (corpo.length > 20000) erros.push('O texto passa de 20000 caracteres.');
	if (!corpo && !imagem) erros.push('Informe um texto, uma imagem ou os dois.');
	if (imagem && !CHAVE_IMAGEM.test(imagem)) erros.push('Imagem inválida.');
	if (erros.length) return { ok: false, erros };
	return { ok: true, valor: { titulo, texto: corpo, imagem_chave: imagem } };
}
