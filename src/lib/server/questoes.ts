import { imagemDe } from '#lib/imagens';
import { filtroDeParams } from '#lib/filtros';
import type { QuestaoValida } from '#lib/questao';
import { db } from './env';
import { apagarImagensSemUso } from './midia-uso';

export type QuestaoLinha = Omit<QuestaoValida, 'config'> & {
	id: number;
	config: unknown;
	criado_em: string;
	atualizado_em: string;
	/** só na listagem: em quantas atividades a questão está */
	em_atividades?: number;
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

export type Filtros = {
	tipo?: string;
	/** Compatível com o filtro antigo de uma etiqueta. */
	etiqueta?: string;
	/** Primeira etiqueta da questão (a disciplina). */
	disciplina?: string;
	/** Todas as etiquetas listadas (E). */
	etiquetas?: string[];
	ativa?: boolean;
	q?: string;
	ordem?: 'recentes' | 'antigas' | 'enunciado' | 'pontos';
	limite?: number;
	offset?: number;
};

/** Lê os filtros da URL (o mesmo formato do painel) já no formato da consulta. */
export function filtrosDeParams(p: URLSearchParams): Filtros {
	const f = filtroDeParams(p);
	return {
		q: f.q || undefined,
		tipo: f.tipo || undefined,
		disciplina: f.disciplina || undefined,
		etiquetas: f.etiquetas.length ? f.etiquetas : undefined,
		ativa: f.ativa === '' ? undefined : f.ativa === '1',
		ordem: f.ordem
	};
}

const TEM_ETIQUETA = 'EXISTS (SELECT 1 FROM json_each(questoes.etiquetas) WHERE value = ?)';

function montarWhere(f: Filtros, ignorar: ('tipo' | 'disciplina' | 'etiquetas')[] = []) {
	const onde: string[] = [];
	const valores: (string | number)[] = [];
	if (f.tipo && !ignorar.includes('tipo')) (onde.push('tipo = ?'), valores.push(f.tipo));
	if (f.ativa !== undefined) (onde.push('ativa = ?'), valores.push(f.ativa ? 1 : 0));
	if (f.disciplina && !ignorar.includes('disciplina')) (onde.push("json_extract(questoes.etiquetas, '$[0]') = ?"), valores.push(f.disciplina));
	if (!ignorar.includes('etiquetas')) {
		for (const e of [...(f.etiqueta ? [f.etiqueta] : []), ...(f.etiquetas ?? [])]) (onde.push(TEM_ETIQUETA), valores.push(e));
	}
	if (f.q) {
		onde.push("enunciado LIKE ? ESCAPE '\\'");
		valores.push(`%${f.q.replace(/[\\%_]/g, '\\$&')}%`);
	}
	return { clausula: onde.length ? `WHERE ${onde.join(' AND ')}` : '', valores };
}

const ORDEM_SQL: Record<NonNullable<Filtros['ordem']>, string> = {
	recentes: 'id DESC',
	antigas: 'id ASC',
	enunciado: 'enunciado COLLATE NOCASE ASC, id DESC',
	pontos: 'pontos DESC, id DESC'
};

export async function listarQuestoes(f: Filtros) {
	const { clausula, valores } = montarWhere(f);
	const limite = Math.min(Math.max(f.limite ?? 25, 1), 100);
	const offset = Math.max(f.offset ?? 0, 0);

	const [itens, total] = await db().batch([
		db()
			.prepare(`SELECT *, (SELECT COUNT(*) FROM atividade_questoes aq WHERE aq.questao_id = questoes.id) AS em_atividades FROM questoes ${clausula} ORDER BY ${ORDEM_SQL[f.ordem ?? 'recentes']} LIMIT ? OFFSET ?`)
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

/**
 * Contagens para os filtros: cada grupo ignora o próprio filtro (para mostrar o que dá para escolher em vez dele)
 * e respeita os outros. As etiquetas respeitam também as já escolhidas, então mostram o que combina com elas.
 */
export async function facetasQuestoes(f: Filtros) {
	const d = montarWhere(f, ['disciplina']);
	const t = montarWhere(f, ['tipo']);
	const e = montarWhere(f, []);
	const [disc, tipos, tags] = await db().batch([
		db().prepare(`SELECT json_extract(questoes.etiquetas, '$[0]') AS valor, COUNT(*) AS n FROM questoes ${d.clausula} GROUP BY valor HAVING valor IS NOT NULL ORDER BY n DESC, valor`).bind(...d.valores),
		db().prepare(`SELECT tipo AS valor, COUNT(*) AS n FROM questoes ${t.clausula} GROUP BY tipo`).bind(...t.valores),
		db().prepare(`SELECT j.value AS valor, COUNT(*) AS n FROM questoes, json_each(questoes.etiquetas) j ${e.clausula} GROUP BY j.value ORDER BY n DESC, valor LIMIT 60`).bind(...e.valores)
	]);
	type L = { valor: string | number; n: number };
	const selecionadas = new Set([...(f.etiqueta ? [f.etiqueta] : []), ...(f.etiquetas ?? [])]);
	return {
		disciplinas: (disc.results as L[]).map((x) => ({ valor: String(x.valor), n: x.n })),
		tipos: Object.fromEntries((tipos.results as L[]).map((x) => [String(x.valor), x.n])) as Record<string, number>,
		etiquetas: (tags.results as L[]).filter((x) => !selecionadas.has(String(x.valor))).map((x) => ({ valor: String(x.valor), n: x.n }))
	};
}

/** Versão enxuta de tudo o que o filtro encontra (até 500), para sortear e para "adicionar todas". */
export async function resumoQuestoes(f: Filtros, max = 500) {
	const { clausula, valores } = montarWhere(f);
	const r = await db()
		.prepare(`SELECT id, tipo, substr(enunciado, 1, 200) AS enunciado, pontos, etiquetas FROM questoes ${clausula} ORDER BY ${ORDEM_SQL[f.ordem ?? 'recentes']} LIMIT ?`)
		.bind(...valores, max)
		.all<{ id: number; tipo: string; enunciado: string; pontos: number; etiquetas: string }>();
	return r.results.map((x) => ({ ...x, etiquetas: JSON.parse(x.etiquetas) as string[] }));
}

export type AcaoLote = 'ativar' | 'inativar' | 'add-etiqueta' | 'remover-etiqueta' | 'definir-disciplina' | 'excluir';

/**
 * Ação em lote sobre as questões escolhidas (por ids ou por tudo o que o filtro encontra). Uma única instrução por ação,
 * então cabe nos limites do D1. `afetadas` conta as que mudaram; excluir ignora as que estão em atividades.
 */
export async function acaoEmLote(alvo: { ids: number[] } | { filtro: Filtros }, acao: AcaoLote, valor?: string) {
	let ondeId: string;
	let valoresId: (string | number)[];
	if ('ids' in alvo) {
		ondeId = 'id IN (SELECT value FROM json_each(?))';
		valoresId = [JSON.stringify(alvo.ids)];
	} else {
		const w = montarWhere(alvo.filtro);
		ondeId = `id IN (SELECT id FROM questoes ${w.clausula})`;
		valoresId = w.valores;
	}
	const agora = "atualizado_em = datetime('now')";
	let sql: string;
	let chavesDasExcluidas: string[] = [];
	switch (acao) {
		case 'ativar':
		case 'inativar':
			sql = `UPDATE questoes SET ativa = ${acao === 'ativar' ? 1 : 0}, ${agora} WHERE ${ondeId} AND ativa = ${acao === 'ativar' ? 0 : 1}`;
			break;
		case 'add-etiqueta':
			sql = `UPDATE questoes SET etiquetas = json_insert(etiquetas, '$[#]', ?), ${agora} WHERE ${ondeId} AND json_array_length(etiquetas) < 10 AND NOT EXISTS (SELECT 1 FROM json_each(questoes.etiquetas) WHERE value = ?)`;
			break;
		case 'remover-etiqueta':
			sql = `UPDATE questoes SET etiquetas = (SELECT json_group_array(value) FROM json_each(questoes.etiquetas) WHERE value <> ?), ${agora} WHERE ${ondeId} AND EXISTS (SELECT 1 FROM json_each(questoes.etiquetas) WHERE value = ?)`;
			break;
		case 'definir-disciplina':
			// a disciplina vira a primeira etiqueta; se já existia em outra posição, sai de lá
			sql = `UPDATE questoes SET etiquetas = (SELECT json_group_array(v) FROM (SELECT ? AS v, 0 AS o UNION ALL SELECT value, 1 + key FROM json_each(questoes.etiquetas) WHERE value <> ? ORDER BY o LIMIT 10)), ${agora} WHERE ${ondeId} AND json_extract(etiquetas, '$[0]') IS NOT ?`;
			break;
		case 'excluir':
			chavesDasExcluidas = (
				await db()
					.prepare(`SELECT DISTINCT json_extract(config, '$.imagem.chave') AS c FROM questoes WHERE ${ondeId} AND NOT EXISTS (SELECT 1 FROM atividade_questoes aq WHERE aq.questao_id = questoes.id) AND json_extract(config, '$.imagem.chave') IS NOT NULL LIMIT 40`)
					.bind(...valoresId)
					.all<{ c: string }>()
			).results.map((x) => x.c);
			sql = `DELETE FROM questoes WHERE ${ondeId} AND NOT EXISTS (SELECT 1 FROM atividade_questoes aq WHERE aq.questao_id = questoes.id)`;
			break;
	}
	// ordem dos parâmetros: os do SET, os do WHERE (ids ou filtro) e, no fim, os do resto do WHERE
	const params =
		acao === 'add-etiqueta' || acao === 'remover-etiqueta'
			? [valor!, ...valoresId, valor!]
			: acao === 'definir-disciplina'
				? [valor!, valor!, ...valoresId, valor!]
				: valoresId;
	const r = await db().prepare(sql).bind(...params).run();
	if (chavesDasExcluidas.length) await apagarImagensSemUso(chavesDasExcluidas, 0);
	return r.meta.changes;
}

/** Todas as questões do filtro (sem paginar), para exportar. */
export async function todasQuestoes(f: Filtros) {
	const { clausula, valores } = montarWhere(f);
	const r = await db().prepare(`SELECT * FROM questoes ${clausula} ORDER BY id`).bind(...valores).all<QuestaoBruta>();
	return r.results.map(mapear);
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

export async function criarQuestao(q: QuestaoValida) {
	const r = await db()
		.prepare(
			'INSERT INTO questoes (tipo, enunciado, config, explicacao, pontos, etiquetas, ativa) VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING id'
		)
		.bind(q.tipo, q.enunciado, JSON.stringify(q.config), q.explicacao, q.pontos, JSON.stringify(q.etiquetas), q.ativa ? 1 : 0)
		.first<{ id: number }>();
	return r!.id;
}

export async function atualizarQuestao(id: number, q: QuestaoValida) {
	const antes = (await obterQuestao(id))?.config;
	const r = await db()
		.prepare(
			"UPDATE questoes SET tipo = ?, enunciado = ?, config = ?, explicacao = ?, pontos = ?, etiquetas = ?, ativa = ?, atualizado_em = datetime('now') WHERE id = ?"
		)
		.bind(q.tipo, q.enunciado, JSON.stringify(q.config), q.explicacao, q.pontos, JSON.stringify(q.etiquetas), q.ativa ? 1 : 0, id)
		.run();
	// trocou ou tirou a imagem: o arquivo antigo só sai do R2 se ninguém mais o usa (apoios, provas já feitas, outras questões)
	const velha = imagemDe(antes)?.chave;
	if (r.meta.changes > 0 && velha && velha !== imagemDe(q.config)?.chave) await apagarImagensSemUso([velha], 0);
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
	const chave = imagemDe((await obterQuestao(id))?.config)?.chave;
	await db().prepare('DELETE FROM questoes WHERE id = ?').bind(id).run();
	if (chave) await apagarImagensSemUso([chave], 0);
	return { status: 'ok' };
}
