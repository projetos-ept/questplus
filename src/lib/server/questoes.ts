import { imagensDe, type ImagemSuporte } from '#lib/imagens';
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
		.prepare('SELECT * FROM suportes WHERE id IN (SELECT value FROM json_each(?)) ORDER BY id')
		.bind(JSON.stringify(ids))
		.all<SuporteBruto>();
	return r.results.map(suporteDe);
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

// ---------- suportes ----------
export type SuporteLinha = Suporte & { id: number; imagem_chave: string | null; criado_em: string; atualizado_em: string; questoes?: number };
type SuporteBruto = Omit<SuporteLinha, 'imagens'> & { imagens: string };

function suporteDe(r: SuporteBruto): SuporteLinha {
	let lista: ImagemSuporte[] = [];
	try {
		lista = JSON.parse(r.imagens) as ImagemSuporte[];
	} catch {
		lista = [];
	}
	return { ...r, imagens: imagensDe({ imagens: lista, imagem_chave: r.imagem_chave }) };
}

export async function listarSuportes() {
	const r = await db()
		.prepare(
			'SELECT s.*, (SELECT COUNT(*) FROM questoes q WHERE q.suporte_id = s.id) AS questoes FROM suportes s ORDER BY s.id DESC'
		)
		.all<SuporteBruto>();
	return r.results.map(suporteDe);
}

export async function obterSuporte(id: number) {
	const r = await db().prepare('SELECT * FROM suportes WHERE id = ?').bind(id).first<SuporteBruto>();
	return r ? suporteDe(r) : null;
}

export async function criarSuporte(s: Suporte) {
	const r = await db()
		.prepare('INSERT INTO suportes (titulo, texto, imagem_chave, imagens) VALUES (?, ?, ?, ?) RETURNING id')
		.bind(s.titulo, s.texto, s.imagens[0]?.chave ?? null, JSON.stringify(s.imagens))
		.first<{ id: number }>();
	return r!.id;
}

/**
 * A imagem só sai do R2 se nenhum outro texto de apoio e nenhuma tentativa já feita (que guarda cópia do apoio) a usa:
 * apagar o arquivo quebraria provas e relatórios antigos.
 */
async function apagarImagensSemUso(chaves: string[], ignorarSuporteId: number) {
	for (const chave of chaves) {
		const uso = await db()
			.prepare(
				`SELECT (SELECT COUNT(*) FROM suportes WHERE id <> ? AND instr(imagens, ?) > 0) +
				        (SELECT COUNT(*) FROM tentativas WHERE instr(questoes, ?) > 0) AS n`
			)
			.bind(ignorarSuporteId, chave, chave)
			.first<{ n: number }>();
		if (uso!.n === 0) await midia()?.delete(chave);
	}
}

export async function atualizarSuporte(id: number, s: Suporte) {
	const antes = await obterSuporte(id);
	if (!antes) return false;
	await db()
		.prepare("UPDATE suportes SET titulo = ?, texto = ?, imagem_chave = ?, imagens = ?, atualizado_em = datetime('now') WHERE id = ?")
		.bind(s.titulo, s.texto, s.imagens[0]?.chave ?? null, JSON.stringify(s.imagens), id)
		.run();
	const novas = new Set(s.imagens.map((i) => i.chave));
	await apagarImagensSemUso(antes.imagens.map((i) => i.chave).filter((c) => !novas.has(c)), id);
	return true;
}

/**
 * Com questões usando o apoio, recusa (devolve quantas) a menos que `desvincular`: aí as questões ficam sem apoio.
 * Provas já feitas guardam a própria cópia do apoio e não mudam.
 */
export async function excluirSuporte(id: number, desvincular = false) {
	const s = await obterSuporte(id);
	if (!s) return 'inexistente' as const;
	const uso = await db().prepare('SELECT COUNT(*) AS n FROM questoes WHERE suporte_id = ?').bind(id).first<{ n: number }>();
	if (uso!.n > 0 && !desvincular) return { emUso: uso!.n };
	await db().batch([
		db().prepare('UPDATE questoes SET suporte_id = NULL WHERE suporte_id = ?').bind(id),
		db().prepare('DELETE FROM suportes WHERE id = ?').bind(id)
	]);
	await apagarImagensSemUso(s.imagens.map((i) => i.chave), id);
	return 'ok' as const;
}
