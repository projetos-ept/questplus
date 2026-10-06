import type { QuestaoValida, Suporte } from '#lib/questao';
import { db, midia } from './env';

export type QuestaoLinha = Omit<QuestaoValida, 'config'> & {
	id: number;
	config: unknown;
	criado_em: string;
	atualizado_em: string;
};
type QuestaoBruta = Omit<QuestaoLinha, 'config' | 'etiquetas' | 'ativa'> & {
	config: string;
	etiquetas: string;
	ativa: number;
};

const mapear = (r: QuestaoBruta): QuestaoLinha => ({
	...r,
	config: JSON.parse(r.config),
	etiquetas: JSON.parse(r.etiquetas),
	ativa: r.ativa === 1
});

export type Filtros = { tipo?: string; etiqueta?: string; ativa?: boolean; q?: string; limite?: number; offset?: number };

function montarWhere(f: Filtros) {
	const onde: string[] = [];
	const valores: (string | number)[] = [];
	if (f.tipo) (onde.push('tipo = ?'), valores.push(f.tipo));
	if (f.ativa !== undefined) (onde.push('ativa = ?'), valores.push(f.ativa ? 1 : 0));
	if (f.etiqueta) (onde.push('EXISTS (SELECT 1 FROM json_each(questoes.etiquetas) WHERE value = ?)'), valores.push(f.etiqueta));
	if (f.q) {
		onde.push("enunciado LIKE ? ESCAPE '\\'");
		valores.push(`%${f.q.replace(/[\\%_]/g, '\\$&')}%`);
	}
	return { clausula: onde.length ? `WHERE ${onde.join(' AND ')}` : '', valores };
}

export async function listarQuestoes(f: Filtros) {
	const { clausula, valores } = montarWhere(f);
	const limite = Math.min(Math.max(f.limite ?? 25, 1), 100);
	const offset = Math.max(f.offset ?? 0, 0);

	const [itens, total] = await db().batch([
		db()
			.prepare(`SELECT * FROM questoes ${clausula} ORDER BY id DESC LIMIT ? OFFSET ?`)
			.bind(...valores, limite, offset),
		db()
			.prepare(`SELECT COUNT(*) AS n FROM questoes ${clausula}`)
			.bind(...valores)
	]);
	return {
		itens: (itens.results as QuestaoBruta[]).map(mapear),
		total: (total.results[0] as { n: number }).n,
		limite,
		offset
	};
}

/** Todas as questões do filtro (sem paginar), para exportar. */
export async function todasQuestoes(f: Filtros) {
	const { clausula, valores } = montarWhere(f);
	const r = await db().prepare(`SELECT * FROM questoes ${clausula} ORDER BY id`).bind(...valores).all<QuestaoBruta>();
	return r.results.map(mapear);
}

export async function suportesPorIds(ids: number[]) {
	if (!ids.length) return [];
	const r = await db()
		.prepare('SELECT id, titulo, texto, imagem_chave FROM suportes WHERE id IN (SELECT value FROM json_each(?)) ORDER BY id')
		.bind(JSON.stringify(ids))
		.all<{ id: number; titulo: string; texto: string; imagem_chave: string | null }>();
	return r.results;
}

export async function etiquetasExistentes() {
	const r = await db()
		.prepare('SELECT DISTINCT value FROM questoes, json_each(questoes.etiquetas) ORDER BY value')
		.all<{ value: string }>();
	return r.results.map((x) => x.value);
}

export async function obterQuestao(id: number) {
	const r = await db().prepare('SELECT * FROM questoes WHERE id = ?').bind(id).first<QuestaoBruta>();
	return r ? mapear(r) : null;
}

export async function suporteExiste(id: number) {
	return (await db().prepare('SELECT 1 AS x FROM suportes WHERE id = ?').bind(id).first()) !== null;
}

export async function criarQuestao(q: QuestaoValida) {
	const r = await db()
		.prepare(
			'INSERT INTO questoes (tipo, enunciado, config, explicacao, pontos, suporte_id, etiquetas, ativa) VALUES (?, ?, ?, ?, ?, ?, ?, ?) RETURNING id'
		)
		.bind(q.tipo, q.enunciado, JSON.stringify(q.config), q.explicacao, q.pontos, q.suporte_id, JSON.stringify(q.etiquetas), q.ativa ? 1 : 0)
		.first<{ id: number }>();
	return r!.id;
}

export async function atualizarQuestao(id: number, q: QuestaoValida) {
	const r = await db()
		.prepare(
			"UPDATE questoes SET tipo = ?, enunciado = ?, config = ?, explicacao = ?, pontos = ?, suporte_id = ?, etiquetas = ?, ativa = ?, atualizado_em = datetime('now') WHERE id = ?"
		)
		.bind(q.tipo, q.enunciado, JSON.stringify(q.config), q.explicacao, q.pontos, q.suporte_id, JSON.stringify(q.etiquetas), q.ativa ? 1 : 0, id)
		.run();
	return r.meta.changes > 0;
}

export async function definirAtiva(id: number, ativa: boolean) {
	const r = await db()
		.prepare("UPDATE questoes SET ativa = ?, atualizado_em = datetime('now') WHERE id = ?")
		.bind(ativa ? 1 : 0, id)
		.run();
	return r.meta.changes > 0;
}

// ---------- suportes ----------
export type SuporteLinha = Suporte & { id: number; criado_em: string; atualizado_em: string; questoes?: number };

export async function listarSuportes() {
	const r = await db()
		.prepare(
			'SELECT s.*, (SELECT COUNT(*) FROM questoes q WHERE q.suporte_id = s.id) AS questoes FROM suportes s ORDER BY s.id DESC'
		)
		.all<SuporteLinha>();
	return r.results;
}

export const obterSuporte = (id: number) => db().prepare('SELECT * FROM suportes WHERE id = ?').bind(id).first<SuporteLinha>();

export async function criarSuporte(s: Suporte) {
	const r = await db()
		.prepare('INSERT INTO suportes (titulo, texto, imagem_chave) VALUES (?, ?, ?) RETURNING id')
		.bind(s.titulo, s.texto, s.imagem_chave)
		.first<{ id: number }>();
	return r!.id;
}

export async function atualizarSuporte(id: number, s: Suporte) {
	const antes = await obterSuporte(id);
	if (!antes) return false;
	await db()
		.prepare("UPDATE suportes SET titulo = ?, texto = ?, imagem_chave = ?, atualizado_em = datetime('now') WHERE id = ?")
		.bind(s.titulo, s.texto, s.imagem_chave, id)
		.run();
	if (antes.imagem_chave && antes.imagem_chave !== s.imagem_chave) await midia()?.delete(antes.imagem_chave);
	return true;
}

/** Recusa se houver questões usando o suporte. Devolve 'ok' | 'inexistente' | 'em-uso'. */
export async function excluirSuporte(id: number) {
	const s = await obterSuporte(id);
	if (!s) return 'inexistente' as const;
	const uso = await db().prepare('SELECT COUNT(*) AS n FROM questoes WHERE suporte_id = ?').bind(id).first<{ n: number }>();
	if (uso!.n > 0) return 'em-uso' as const;
	await db().prepare('DELETE FROM suportes WHERE id = ?').bind(id).run();
	if (s.imagem_chave) await midia()?.delete(s.imagem_chave);
	return 'ok' as const;
}

/**
 * Exclui a questão. Se ela está em alguma atividade, recusa e devolve os títulos: a ligação existe no banco e tirar a
 * questão de uma atividade em uso mudaria a prova. Tentativas já feitas guardam uma cópia da questão e não são afetadas.
 */
export async function excluirQuestao(id: number): Promise<{ status: 'ok' | 'inexistente' } | { status: 'em-uso'; atividades: string[]; total: number }> {
	if (!(await obterQuestao(id))) return { status: 'inexistente' };
	const uso = await db()
		.prepare('SELECT a.titulo FROM atividade_questoes aq JOIN atividades a ON a.id = aq.atividade_id WHERE aq.questao_id = ? ORDER BY a.titulo')
		.bind(id)
		.all<{ titulo: string }>();
	if (uso.results.length) return { status: 'em-uso', atividades: uso.results.slice(0, 5).map((x) => x.titulo), total: uso.results.length };
	await db().prepare('DELETE FROM questoes WHERE id = ?').bind(id).run();
	return { status: 'ok' };
}
