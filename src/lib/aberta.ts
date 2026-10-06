import type { Aberta } from './questao';

/** Tudo aqui é regra, sem IA: roda antes de qualquer modelo e é a parte barata, previsível e auditável. */

export type Nivel = 0 | 1 | 2 | 3 | 4;

export const normalizar = (s: string) =>
	s
		.normalize('NFD')
		.replace(/[̀-ͯ]/g, '')
		.toLowerCase()
		.replace(/[^\p{L}\p{N}]+/gu, ' ')
		.trim();

const palavras = (s: string) => normalizar(s).split(' ').filter(Boolean);

/** Procura o termo como palavra(s) inteira(s): "reduz" não casa com "reduzido" por acidente de prefixo longo, mas aceita o plural simples. */
function contem(textoNorm: string, termo: string) {
	const t = normalizar(termo);
	if (!t) return false;
	return ` ${textoNorm} `.includes(` ${t} `) || ` ${textoNorm} `.includes(` ${t}s `) || ` ${textoNorm} `.includes(` ${t}es `);
}

export type Triagem = { ok: true } | { ok: false; motivo: string };

/** Nota 0 automática, sem gastar cota de IA: em branco, curta demais, só símbolos/repetição ou cópia do enunciado. */
export function triar(resposta: string, enunciado: string, cfg: Pick<Aberta, 'min_chars'>): Triagem {
	const bruto = resposta.trim();
	if (!bruto) return { ok: false, motivo: 'Resposta em branco.' };
	const letras = (bruto.match(/[\p{L}\p{N}]/gu) ?? []).length;
	if (letras === 0) return { ok: false, motivo: 'Resposta só com pontuação ou símbolos.' };
	if (bruto.length < cfg.min_chars) return { ok: false, motivo: `Resposta menor que o mínimo de ${cfg.min_chars} caracteres.` };
	const ps = palavras(bruto);
	if (ps.length >= 4 && new Set(ps).size <= 1) return { ok: false, motivo: 'Resposta com a mesma palavra repetida.' };
	if (/(.)\1{9,}/u.test(normalizar(bruto).replace(/ /g, ''))) return { ok: false, motivo: 'Resposta com caracteres repetidos.' };
	const en = normalizar(enunciado);
	const rn = normalizar(bruto);
	if (en && rn && (rn === en || (rn.length >= 20 && en.includes(rn)))) return { ok: false, motivo: 'Resposta apenas copia o enunciado.' };
	return { ok: true };
}

export type EvidenciaConceito = { nome: string; presente: boolean; termo: string | null };

/** Quais conceitos-chave aparecem no texto (nome ou sinônimo cadastrado). É evidência para o modelo, não veredito. */
export function conferirConceitos(resposta: string, cfg: Pick<Aberta, 'conceitos'>): EvidenciaConceito[] {
	const n = normalizar(resposta);
	return cfg.conceitos.map((c) => {
		const termo = [c.nome, ...c.sinonimos].find((t) => contem(n, t)) ?? null;
		return { nome: c.nome, presente: termo !== null, termo };
	});
}

export type AlertaOposicao = { lado_referencia: string; lado_oposto: string };

/** Palavras que vêm logo depois do termo, no texto (só as de mais de 3 letras, para ignorar "a", "de", "pelas"...). */
function contextoDe(texto: string, termo: string): Set<string> {
	const toks = normalizar(texto).split(' ').filter(Boolean);
	const t = normalizar(termo).split(' ').filter(Boolean);
	const r = new Set<string>();
	if (!t.length) return r;
	for (let i = 0; i + t.length <= toks.length; i++) {
		if (t.every((w, k) => toks[i + k] === w)) for (const w of toks.slice(i + t.length, i + t.length + 5)) if (w.length > 3) r.add(w);
	}
	return r;
}
const sobreposicao = (a: Set<string>, b: Set<string>) => [...a].filter((w) => b.has(w)).length;

/**
 * Par de oposição (aumenta/reduz): possível erro conceitual quando a resposta troca os lados. Duas regras:
 * (1) a referência usa só um lado e a resposta usa só o contrário; (2) a referência usa os dois lados, mas a resposta
 * põe cada termo junto das palavras que, na referência, acompanham o termo contrário ("reduz a captação" onde a
 * referência diz "aumenta a captação").
 */
export function conferirOposicoes(resposta: string, cfg: Pick<Aberta, 'referencia' | 'oposicoes'>): AlertaOposicao[] {
	const r = normalizar(resposta);
	const ref = normalizar(cfg.referencia);
	const alertas: AlertaOposicao[] = [];
	const juntar = (a: AlertaOposicao) => {
		if (!alertas.some((x) => x.lado_referencia === a.lado_referencia && x.lado_oposto === a.lado_oposto)) alertas.push(a);
	};
	for (const [a, b] of cfg.oposicoes) {
		for (const [certo, oposto] of [[a, b], [b, a]] as const) {
			if (contem(ref, certo) && !contem(ref, oposto) && contem(r, oposto) && !contem(r, certo)) juntar({ lado_referencia: certo, lado_oposto: oposto });
			if (contem(ref, certo) && contem(ref, oposto) && contem(r, oposto)) {
				const noTexto = contextoDe(resposta, oposto);
				if (sobreposicao(noTexto, contextoDe(cfg.referencia, certo)) > sobreposicao(noTexto, contextoDe(cfg.referencia, oposto))) juntar({ lado_referencia: certo, lado_oposto: oposto });
			}
		}
	}
	return alertas;
}

export const pontosDoNivel = (nivel: number, pontos: number, cfg: Pick<Aberta, 'pontos_por_nivel'>) => {
	const pct = cfg.pontos_por_nivel[Math.min(Math.max(Math.round(nivel), 0), 4)] ?? 0;
	return Math.round(((pontos * pct) / 100) * 100) / 100;
};

export const nivelValido = (n: unknown): n is Nivel => typeof n === 'number' && Number.isInteger(n) && n >= 0 && n <= 4;

// ---------- similaridade e alertas de divergência ----------

export function cosseno(a: number[], b: number[]): number {
	if (a.length === 0 || a.length !== b.length) return 0;
	let ab = 0, aa = 0, bb = 0;
	for (let i = 0; i < a.length; i++) {
		ab += a[i] * b[i];
		aa += a[i] * a[i];
		bb += b[i] * b[i];
	}
	return aa && bb ? ab / Math.sqrt(aa * bb) : 0;
}

/** % de aproximação (0 a 100, uma casa). Cosseno negativo vira 0. */
export const percentualDe = (cos: number) => Math.round(Math.min(Math.max(cos, 0), 1) * 1000) / 10;

export type Alerta = { codigo: 'parecido_mas_erro' | 'diferente_mas_bom' | 'possivel_oposicao' | 'possivel_copia'; texto: string };

/** Regras sobre os dois números (documentadas em docs/questoes-abertas-ia.md). `copia` vem de comparar com outros alunos. */
export function alertasDe(a: { nivel: number | null; aproximacao: number | null; oposicoes: AlertaOposicao[]; copia?: boolean }): Alerta[] {
	const r: Alerta[] = [];
	if (a.nivel !== null && a.aproximacao !== null) {
		if (a.aproximacao >= 80 && a.nivel <= 1) r.push({ codigo: 'parecido_mas_erro', texto: 'Texto muito parecido com a referência, mas o modelo vê erro de conceito. Confira.' });
		if (a.aproximacao < 40 && a.nivel >= 3) r.push({ codigo: 'diferente_mas_bom', texto: 'Texto diferente da referência, mas o modelo vê resposta boa. Confira.' });
	}
	for (const o of a.oposicoes) r.push({ codigo: 'possivel_oposicao', texto: `Possível erro conceitual: a referência usa "${o.lado_referencia}" e a resposta usa "${o.lado_oposto}".` });
	if (a.copia) r.push({ codigo: 'possivel_copia', texto: 'Resposta quase idêntica à de outro aluno (possível cópia).' });
	return r;
}

/** Quanto mais os dois números discordam, mais a resposta precisa de olho humano (para ordenar a fila). */
export function divergenciaDe(nivel: number | null, aproximacao: number | null): number {
	if (nivel === null || aproximacao === null) return 0;
	return Math.abs(nivel / 4 - aproximacao / 100);
}

// ---------- contrato com o modelo de linguagem ----------

export const VERSAO_PROMPT = 'v1';

export type SaidaIA = {
	nivel: Nivel;
	conceitos_presentes: string[];
	conceitos_faltantes: string[];
	erro_conceitual: boolean;
	justificativa: string;
};

/** Extrai o primeiro objeto JSON de um texto (alguns modelos cercam a resposta com explicação ou bloco de código). */
export function extrairJson(bruto: unknown): unknown {
	if (bruto && typeof bruto === 'object') return bruto;
	if (typeof bruto !== 'string') return null;
	const ini = bruto.indexOf('{');
	const fim = bruto.lastIndexOf('}');
	if (ini < 0 || fim <= ini) return null;
	try {
		return JSON.parse(bruto.slice(ini, fim + 1));
	} catch {
		return null;
	}
}

/** O modelo só pode responder neste esquema; qualquer outra coisa vai para revisão manual. */
export function validarSaidaIA(x: unknown): { ok: true; valor: SaidaIA } | { ok: false; erro: string } {
	const o = (x && typeof x === 'object' ? x : null) as Record<string, unknown> | null;
	if (!o) return { ok: false, erro: 'Resposta do modelo não é um objeto JSON.' };
	const nivel = typeof o.nivel === 'string' && /^\d$/.test(o.nivel) ? Number(o.nivel) : o.nivel;
	if (!nivelValido(nivel)) return { ok: false, erro: 'Nível fora do intervalo 0 a 4.' };
	const lista = (v: unknown) => (Array.isArray(v) && v.every((i) => typeof i === 'string') ? (v as string[]).slice(0, 12).map((i) => i.slice(0, 120)) : null);
	const presentes = lista(o.conceitos_presentes);
	const faltantes = lista(o.conceitos_faltantes);
	if (!presentes || !faltantes) return { ok: false, erro: 'Listas de conceitos inválidas.' };
	if (typeof o.erro_conceitual !== 'boolean') return { ok: false, erro: 'Campo erro_conceitual inválido.' };
	if (typeof o.justificativa !== 'string' || !o.justificativa.trim()) return { ok: false, erro: 'Justificativa ausente.' };
	return { ok: true, valor: { nivel, conceitos_presentes: presentes, conceitos_faltantes: faltantes, erro_conceitual: o.erro_conceitual, justificativa: o.justificativa.trim().slice(0, 400) } };
}

/** Similaridade de texto barata (Jaccard de trigramas de palavras) para achar respostas quase idênticas entre alunos. */
export function similaridadeTexto(a: string, b: string): number {
	const tri = (s: string) => {
		const p = palavras(s);
		const r = new Set<string>();
		if (p.length < 3) return new Set(p);
		for (let i = 0; i + 2 < p.length; i++) r.add(p.slice(i, i + 3).join(' '));
		return r;
	};
	const A = tri(a), B = tri(b);
	if (!A.size || !B.size) return 0;
	let inter = 0;
	for (const x of A) if (B.has(x)) inter++;
	return inter / (A.size + B.size - inter);
}
