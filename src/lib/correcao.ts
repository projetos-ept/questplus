import type { Mc, Vf } from './questao';

export type RespostaMc = { escolha: number };
export type RespostaVf = { valores: (boolean | null)[] };

export type Correcao = {
	pontos: number;
	max: number;
	acertou: 'sim' | 'parcial' | 'nao';
	gabarito: { correta: number } | { valores: boolean[] };
};

const arredondar = (n: number) => Math.round(n * 100) / 100;

export function validarResposta(
	tipo: string,
	config: unknown,
	resposta: unknown
): { ok: true; valor: RespostaMc | RespostaVf } | { ok: false; erro: string } {
	const r = (resposta && typeof resposta === 'object' ? resposta : {}) as Record<string, unknown>;
	if (tipo === 'mc') {
		const n = (config as Mc).alternativas.length;
		if (typeof r.escolha !== 'number' || !Number.isInteger(r.escolha) || r.escolha < 0 || r.escolha >= n) {
			return { ok: false, erro: 'Escolha uma das alternativas.' };
		}
		return { ok: true, valor: { escolha: r.escolha } };
	}
	if (tipo === 'vf') {
		const n = (config as Vf).afirmacoes.length;
		const v = r.valores;
		if (!Array.isArray(v) || v.length !== n || v.some((x) => x !== null && typeof x !== 'boolean')) {
			return { ok: false, erro: 'Responda cada afirmação com verdadeiro ou falso.' };
		}
		return { ok: true, valor: { valores: v as (boolean | null)[] } };
	}
	return { ok: false, erro: 'Tipo de questão ainda não suportado.' };
}

/** MC: tudo ou nada. VF: proporcional às afirmações certas; erro não desconta, afirmação em branco não pontua. */
export function corrigir(tipo: string, config: unknown, resposta: RespostaMc | RespostaVf, pontos: number): Correcao {
	if (tipo === 'mc') {
		const c = config as Mc;
		const acertou = (resposta as RespostaMc).escolha === c.correta;
		return { pontos: acertou ? pontos : 0, max: pontos, acertou: acertou ? 'sim' : 'nao', gabarito: { correta: c.correta } };
	}
	const c = config as Vf;
	const gabarito = c.afirmacoes.map((a) => a.valor);
	const certas = (resposta as RespostaVf).valores.filter((v, i) => v === gabarito[i]).length;
	return {
		pontos: arredondar((pontos * certas) / gabarito.length),
		max: pontos,
		acertou: certas === gabarito.length ? 'sim' : certas === 0 ? 'nao' : 'parcial',
		gabarito: { valores: gabarito }
	};
}
