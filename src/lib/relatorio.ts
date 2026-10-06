export type TentativaResumo = {
	id: number;
	nome: string;
	email: string;
	turma: string;
	status: 'andamento' | 'finalizada';
	anulada: number;
	inicio_em: string;
	finalizada_em: string | null;
	nota: number | null;
	pontos_max: number | null;
};

export type AlunoConsolidado = {
	chave: string;
	nome: string;
	email: string;
	turma: string;
	/** Tentativas finalizadas e não anuladas. */
	tentativas: number;
	/** A tentativa de maior nota (vale a maior nota do aluno). */
	melhor: TentativaResumo;
	percentual: number;
	tempoSegundos: number | null;
};

export const percentualDe = (nota: number | null, max: number | null) => (max && max > 0 ? Math.round(((nota ?? 0) / max) * 1000) / 10 : 0);

export const valida = (t: TentativaResumo) => t.status === 'finalizada' && !t.anulada;

export function tempoGasto(t: Pick<TentativaResumo, 'inicio_em' | 'finalizada_em'>): number | null {
	if (!t.finalizada_em) return null;
	const s = Math.round((Date.parse(t.finalizada_em) - Date.parse(t.inicio_em)) / 1000);
	return Number.isFinite(s) && s >= 0 ? s : null;
}

export function formatarTempo(seg: number | null): string {
	if (seg === null) return '—';
	const h = Math.floor(seg / 3600);
	const m = Math.floor((seg % 3600) / 60);
	const s = seg % 60;
	return h ? `${h}h ${String(m).padStart(2, '0')}min` : m ? `${m}min ${String(s).padStart(2, '0')}s` : `${s}s`;
}

/**
 * Uma linha por aluno (identificado pelo e-mail), com a tentativa de maior nota (em %, para não depender de a prova ter
 * sido editada no meio). Empate: a que terminou primeiro. Tentativas anuladas e em andamento não contam.
 */
export function consolidar(tentativas: TentativaResumo[]): AlunoConsolidado[] {
	const grupos = new Map<string, TentativaResumo[]>();
	for (const t of tentativas.filter(valida)) {
		const k = t.email.trim().toLowerCase();
		grupos.set(k, [...(grupos.get(k) ?? []), t]);
	}
	const alunos: AlunoConsolidado[] = [];
	for (const [chave, lista] of grupos) {
		const melhor = [...lista].sort(
			(a, b) =>
				percentualDe(b.nota, b.pontos_max) - percentualDe(a.nota, a.pontos_max) ||
				(a.finalizada_em ?? '').localeCompare(b.finalizada_em ?? '') ||
				a.id - b.id
		)[0];
		alunos.push({
			chave,
			nome: melhor.nome,
			email: melhor.email,
			turma: melhor.turma,
			tentativas: lista.length,
			melhor,
			percentual: percentualDe(melhor.nota, melhor.pontos_max),
			tempoSegundos: tempoGasto(melhor)
		});
	}
	return alunos.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR') || a.chave.localeCompare(b.chave));
}

export type Resumo = {
	alunos: number;
	tentativas: number;
	anuladas: number;
	emAndamento: number;
	mediaPontos: number | null;
	mediaPercentual: number | null;
	medianaPercentual: number | null;
	maiorPercentual: number | null;
	menorPercentual: number | null;
	/** Alunos por faixa de percentual: 0–20, 20–40, 40–60, 60–80, 80–100 (100 entra na última). */
	distribuicao: { rotulo: string; alunos: number }[];
};

const arredondar1 = (n: number) => Math.round(n * 10) / 10;

export function resumir(tentativas: TentativaResumo[], alunos: AlunoConsolidado[]): Resumo {
	const pct = alunos.map((a) => a.percentual).sort((a, b) => a - b);
	const meio = pct.length >> 1;
	const faixas = [0, 0, 0, 0, 0];
	for (const p of pct) faixas[Math.min(Math.floor(p / 20), 4)]++;
	return {
		alunos: alunos.length,
		tentativas: tentativas.filter(valida).length,
		anuladas: tentativas.filter((t) => t.anulada).length,
		emAndamento: tentativas.filter((t) => !t.anulada && t.status === 'andamento').length,
		mediaPontos: alunos.length ? arredondar1(alunos.reduce((s, a) => s + (a.melhor.nota ?? 0), 0) / alunos.length) : null,
		mediaPercentual: pct.length ? arredondar1(pct.reduce((s, p) => s + p, 0) / pct.length) : null,
		medianaPercentual: pct.length ? (pct.length % 2 ? pct[meio] : arredondar1((pct[meio - 1] + pct[meio]) / 2)) : null,
		maiorPercentual: pct.length ? pct[pct.length - 1] : null,
		menorPercentual: pct.length ? pct[0] : null,
		distribuicao: ['0–20%', '20–40%', '40–60%', '60–80%', '80–100%'].map((rotulo, i) => ({ rotulo, alunos: faixas[i] }))
	};
}

// ---------- aproveitamento por questão ----------

export type QuestaoDaTentativa = { id: number; tipo: string; enunciado: string; pontos: number };

export type AproveitamentoQuestao = {
	id: number;
	tipo: string;
	enunciado: string;
	/** Alunos (tentativa considerada) que tinham a questão. */
	alunos: number;
	respondida: number;
	emBranco: number;
	/** Pontos obtidos ÷ pontos possíveis, em %. */
	aproveitamento: number;
};

/** `considerada`: a tentativa de maior nota de cada aluno, com as questões que ela tinha e os pontos por questão. */
export function aproveitamentoPorQuestao(considerada: { questoes: QuestaoDaTentativa[]; pontosPorQuestao: Map<number, number> }[]): AproveitamentoQuestao[] {
	const por = new Map<number, AproveitamentoQuestao & { obtidos: number; possiveis: number }>();
	for (const t of considerada) {
		for (const q of t.questoes) {
			const r = por.get(q.id) ?? { id: q.id, tipo: q.tipo, enunciado: q.enunciado, alunos: 0, respondida: 0, emBranco: 0, aproveitamento: 0, obtidos: 0, possiveis: 0 };
			r.alunos++;
			r.possiveis += q.pontos;
			if (t.pontosPorQuestao.has(q.id)) {
				r.respondida++;
				r.obtidos += t.pontosPorQuestao.get(q.id) ?? 0;
			} else r.emBranco++;
			por.set(q.id, r);
		}
	}
	return [...por.values()].map(({ obtidos, possiveis, ...r }) => ({ ...r, aproveitamento: possiveis > 0 ? arredondar1((obtidos / possiveis) * 100) : 0 }));
}

// ---------- CSV (pronto para Excel e LibreOffice em português) ----------

/**
 * Uma célula do CSV. Nome e e-mail vêm do aluno; um texto começando com = + - @ (ou tab/CR) seria executado como
 * fórmula pela planilha, então ganha uma aspa simples na frente. Aspas e ponto e vírgula são protegidos.
 */
export function celulaCsv(valor: string | number | null | undefined): string {
	if (valor === null || valor === undefined) return '';
	if (typeof valor === 'number') return String(valor).replace('.', ',');
	let t = valor;
	if (/^[=+\-@\t\r]/.test(t)) t = `'${t}`;
	return /[;"\n\r]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
}

/** UTF-8 com BOM, separador ponto e vírgula e quebra de linha CRLF. */
export function montarCsv(linhas: (string | number | null | undefined)[][]): string {
	return '﻿' + linhas.map((l) => l.map(celulaCsv).join(';')).join('\r\n') + '\r\n';
}
