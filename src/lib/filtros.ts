/** Filtros das listas de questões (painel e seletor de atividade): um só modelo, que viaja na URL. */
export type FiltroQuestoes = {
	q: string;
	tipo: '' | 'mc' | 'vf' | 'aberta';
	disciplina: string;
	etiquetas: string[];
	ativa: '' | '1' | '0';
	ordem: 'recentes' | 'antigas' | 'enunciado' | 'pontos';
};

export const filtroVazio = (): FiltroQuestoes => ({ q: '', tipo: '', disciplina: '', etiquetas: [], ativa: '', ordem: 'recentes' });

export const ORDENS: [FiltroQuestoes['ordem'], string][] = [
	['recentes', 'Mais recentes'],
	['antigas', 'Mais antigas'],
	['enunciado', 'Enunciado (A–Z)'],
	['pontos', 'Mais pontos']
];

const um = (v: string | null, validos: string[]) => (v !== null && validos.includes(v) ? v : '');

export function filtroDeParams(p: URLSearchParams): FiltroQuestoes {
	const etiquetas = (p.get('etiquetas') ?? p.get('etiqueta') ?? '')
		.split(',')
		.map((e) => e.trim().toLowerCase())
		.filter(Boolean);
	return {
		q: (p.get('q') ?? '').trim(),
		tipo: um(p.get('tipo'), ['mc', 'vf', 'aberta']) as FiltroQuestoes['tipo'],
		disciplina: (p.get('disciplina') ?? '').trim().toLowerCase(),
		etiquetas: [...new Set(etiquetas)].slice(0, 6),
		ativa: um(p.get('ativa'), ['1', '0']) as FiltroQuestoes['ativa'],
		ordem: (um(p.get('ordem'), ORDENS.map((o) => o[0])) || 'recentes') as FiltroQuestoes['ordem']
	};
}

/** Só o que difere do padrão vai para a URL. */
export function paramsDeFiltro(f: FiltroQuestoes, extra: Record<string, string | number> = {}) {
	const p = new URLSearchParams();
	if (f.q.trim()) p.set('q', f.q.trim());
	if (f.tipo) p.set('tipo', f.tipo);
	if (f.disciplina) p.set('disciplina', f.disciplina);
	if (f.etiquetas.length) p.set('etiquetas', f.etiquetas.join(','));
	if (f.ativa) p.set('ativa', f.ativa);
	if (f.ordem !== 'recentes') p.set('ordem', f.ordem);
	for (const [k, v] of Object.entries(extra)) p.set(k, String(v));
	return p;
}

/** Quantos filtros estão ligados (a ordem não conta). */
export const filtrosAtivos = (f: FiltroQuestoes, contarSituacao = true) => [f.q.trim(), f.tipo, f.disciplina, f.etiquetas.length ? 'x' : '', contarSituacao ? f.ativa : ''].filter(Boolean).length;
