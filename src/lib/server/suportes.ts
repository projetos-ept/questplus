import { filtroDeParams } from '#lib/filtros';
import { imagensDe, type ImagemSuporte } from '#lib/imagens';
import type { Suporte } from '#lib/questao';
import { db } from './env';
import { apagarImagensSemUso } from './midia-uso';

export type SuporteLinha = Suporte & {
	id: number;
	imagem_chave: string | null;
	criado_em: string;
	atualizado_em: string;
	/** só na listagem: em quantas atividades o texto está */
	atividades?: number;
};
type SuporteBruto = Omit<SuporteLinha, 'imagens' | 'etiquetas'> & { imagens: string; etiquetas: string };

function suporteDe(r: SuporteBruto): SuporteLinha {
	let lista: ImagemSuporte[] = [];
	let etiquetas: string[] = [];
	try {
		lista = JSON.parse(r.imagens) as ImagemSuporte[];
	} catch {
		lista = [];
	}
	try {
		etiquetas = JSON.parse(r.etiquetas ?? '[]') as string[];
	} catch {
		etiquetas = [];
	}
	return { ...r, imagens: imagensDe({ imagens: lista, imagem_chave: r.imagem_chave }), etiquetas };
}

export type FiltrosSuportes = {
	q?: string;
	disciplina?: string;
	etiquetas?: string[];
	ordem?: 'recentes' | 'antigas' | 'enunciado';
	limite?: number;
	offset?: number;
};

/** Lê os filtros da URL (o mesmo formato das questões; só busca, disciplina, etiquetas e ordem valem aqui). */
export function filtrosSuportesDeParams(p: URLSearchParams): FiltrosSuportes {
	const f = filtroDeParams(p);
	return {
		q: f.q || undefined,
		disciplina: f.disciplina || undefined,
		etiquetas: f.etiquetas.length ? f.etiquetas : undefined,
		ordem: f.ordem === 'antigas' || f.ordem === 'enunciado' ? f.ordem : 'recentes'
	};
}

type Ignorar = ('disciplina' | 'etiquetas')[];
function montarWhere(f: FiltrosSuportes, ignorar: Ignorar = []) {
	const onde: string[] = [];
	const valores: (string | number)[] = [];
	if (f.disciplina && !ignorar.includes('disciplina')) (onde.push("json_extract(suportes.etiquetas, '$[0]') = ?"), valores.push(f.disciplina));
	if (!ignorar.includes('etiquetas')) for (const e of f.etiquetas ?? []) (onde.push('EXISTS (SELECT 1 FROM json_each(suportes.etiquetas) WHERE value = ?)'), valores.push(e));
	if (f.q) {
		onde.push("(titulo LIKE ? ESCAPE '\\' OR texto LIKE ? ESCAPE '\\')");
		const t = `%${f.q.replace(/[\\%_]/g, '\\$&')}%`;
		valores.push(t, t);
	}
	return { clausula: onde.length ? `WHERE ${onde.join(' AND ')}` : '', valores };
}

const ORDEM_SQL = { recentes: 'id DESC', antigas: 'id ASC', enunciado: 'titulo COLLATE NOCASE ASC, id DESC' } as const;

export async function listarSuportes(f: FiltrosSuportes = {}) {
	const { clausula, valores } = montarWhere(f);
	const limite = Math.min(Math.max(f.limite ?? 500, 1), 500);
	const offset = Math.max(f.offset ?? 0, 0);
	const [itens, total] = await db().batch([
		db()
			.prepare(`SELECT *, (SELECT COUNT(*) FROM atividades a WHERE a.suporte_id = suportes.id) AS atividades FROM suportes ${clausula} ORDER BY ${ORDEM_SQL[f.ordem ?? 'recentes']} LIMIT ? OFFSET ?`)
			.bind(...valores, limite, offset),
		db().prepare(`SELECT COUNT(*) AS n FROM suportes ${clausula}`).bind(...valores)
	]);
	return { itens: (itens.results as SuporteBruto[]).map(suporteDe), total: (total.results[0] as { n: number }).n };
}

/** Contagens por disciplina e etiqueta para os filtros (mesma lógica das questões). */
export async function facetasSuportes(f: FiltrosSuportes) {
	const d = montarWhere(f, ['disciplina']);
	const e = montarWhere(f);
	const [disc, tags] = await db().batch([
		db().prepare(`SELECT json_extract(suportes.etiquetas, '$[0]') AS valor, COUNT(*) AS n FROM suportes ${d.clausula} GROUP BY valor HAVING valor IS NOT NULL ORDER BY n DESC, valor`).bind(...d.valores),
		db().prepare(`SELECT j.value AS valor, COUNT(*) AS n FROM suportes, json_each(suportes.etiquetas) j ${e.clausula} GROUP BY j.value ORDER BY n DESC, valor LIMIT 60`).bind(...e.valores)
	]);
	type L = { valor: string; n: number };
	const escolhidas = new Set(f.etiquetas ?? []);
	return {
		disciplinas: (disc.results as L[]).map((x) => ({ valor: String(x.valor), n: x.n })),
		tipos: {} as Record<string, number>,
		etiquetas: (tags.results as L[]).filter((x) => !escolhidas.has(String(x.valor))).map((x) => ({ valor: String(x.valor), n: x.n }))
	};
}

export async function obterSuporte(id: number) {
	const r = await db().prepare('SELECT * FROM suportes WHERE id = ?').bind(id).first<SuporteBruto>();
	return r ? suporteDe(r) : null;
}

export async function suporteExiste(id: number) {
	return (await db().prepare('SELECT 1 AS x FROM suportes WHERE id = ?').bind(id).first()) !== null;
}

export async function criarSuporte(s: Suporte) {
	const r = await db()
		.prepare('INSERT INTO suportes (titulo, texto, imagem_chave, imagens, etiquetas) VALUES (?, ?, ?, ?, ?) RETURNING id')
		.bind(s.titulo, s.texto, s.imagens[0]?.chave ?? null, JSON.stringify(s.imagens), JSON.stringify(s.etiquetas))
		.first<{ id: number }>();
	return r!.id;
}

export async function atualizarSuporte(id: number, s: Suporte) {
	const antes = await obterSuporte(id);
	if (!antes) return false;
	await db()
		.prepare("UPDATE suportes SET titulo = ?, texto = ?, imagem_chave = ?, imagens = ?, etiquetas = ?, atualizado_em = datetime('now') WHERE id = ?")
		.bind(s.titulo, s.texto, s.imagens[0]?.chave ?? null, JSON.stringify(s.imagens), JSON.stringify(s.etiquetas), id)
		.run();
	const novas = new Set(s.imagens.map((i) => i.chave));
	await apagarImagensSemUso(antes.imagens.map((i) => i.chave).filter((c) => !novas.has(c)), id);
	return true;
}

/**
 * Com atividades usando o texto, recusa (devolve quantas e quais) a menos que `desvincular`: aí as atividades ficam sem
 * texto de apoio. Provas já feitas guardam a própria cópia do apoio e não mudam.
 */
export async function excluirSuporte(id: number, desvincular = false) {
	const s = await obterSuporte(id);
	if (!s) return 'inexistente' as const;
	const uso = await db().prepare('SELECT titulo FROM atividades WHERE suporte_id = ? ORDER BY titulo').bind(id).all<{ titulo: string }>();
	if (uso.results.length > 0 && !desvincular) return { emUso: uso.results.length, atividades: uso.results.slice(0, 5).map((x) => x.titulo) };
	await db().batch([
		db().prepare('UPDATE atividades SET suporte_id = NULL WHERE suporte_id = ?').bind(id),
		db().prepare('DELETE FROM suportes WHERE id = ?').bind(id)
	]);
	await apagarImagensSemUso(s.imagens.map((i) => i.chave), id);
	return 'ok' as const;
}

/** Versão enxuta (até 500) para o seletor da atividade: sem o texto inteiro. */
export async function resumoSuportes(f: FiltrosSuportes) {
	const { clausula, valores } = montarWhere(f);
	const r = await db()
		.prepare(`SELECT id, titulo, etiquetas, length(texto) AS caracteres, imagens FROM suportes ${clausula} ORDER BY ${ORDEM_SQL[f.ordem ?? 'recentes']} LIMIT 500`)
		.bind(...valores)
		.all<{ id: number; titulo: string; etiquetas: string; caracteres: number; imagens: string }>();
	return r.results.map((x) => ({ id: x.id, titulo: x.titulo, etiquetas: JSON.parse(x.etiquetas ?? '[]') as string[], caracteres: x.caracteres, imagens: (JSON.parse(x.imagens || '[]') as unknown[]).length }));
}

export type AcaoLoteSuportes = 'add-etiqueta' | 'remover-etiqueta' | 'definir-disciplina' | 'excluir';

/** Ações em lote nos textos de apoio, por ids ou pelo filtro; excluir pula os que estão em atividades. */
export async function acaoSuportesEmLote(alvo: { ids: number[] } | { filtro: FiltrosSuportes }, acao: AcaoLoteSuportes, valor?: string) {
	let ondeId: string;
	let valoresId: (string | number)[];
	if ('ids' in alvo) {
		ondeId = 'id IN (SELECT value FROM json_each(?))';
		valoresId = [JSON.stringify(alvo.ids)];
	} else {
		const w = montarWhere(alvo.filtro);
		ondeId = `id IN (SELECT id FROM suportes ${w.clausula})`;
		valoresId = w.valores;
	}
	const agora = "atualizado_em = datetime('now')";
	let sql: string;
	let chaves: string[] = [];
	switch (acao) {
		case 'add-etiqueta':
			sql = `UPDATE suportes SET etiquetas = json_insert(etiquetas, '$[#]', ?), ${agora} WHERE ${ondeId} AND json_array_length(etiquetas) < 10 AND NOT EXISTS (SELECT 1 FROM json_each(suportes.etiquetas) WHERE value = ?)`;
			break;
		case 'remover-etiqueta':
			sql = `UPDATE suportes SET etiquetas = (SELECT json_group_array(value) FROM json_each(suportes.etiquetas) WHERE value <> ?), ${agora} WHERE ${ondeId} AND EXISTS (SELECT 1 FROM json_each(suportes.etiquetas) WHERE value = ?)`;
			break;
		case 'definir-disciplina':
			sql = `UPDATE suportes SET etiquetas = (SELECT json_group_array(v) FROM (SELECT ? AS v, 0 AS o UNION ALL SELECT value, 1 + key FROM json_each(suportes.etiquetas) WHERE value <> ? ORDER BY o LIMIT 10)), ${agora} WHERE ${ondeId} AND json_extract(etiquetas, '$[0]') IS NOT ?`;
			break;
		case 'excluir': {
			const livres = `${ondeId} AND NOT EXISTS (SELECT 1 FROM atividades a WHERE a.suporte_id = suportes.id)`;
			const imgs = await db().prepare(`SELECT imagens FROM suportes WHERE ${livres} LIMIT 40`).bind(...valoresId).all<{ imagens: string }>();
			chaves = [...new Set(imgs.results.flatMap((x) => (JSON.parse(x.imagens || '[]') as ImagemSuporte[]).map((i) => i.chave)))];
			sql = `DELETE FROM suportes WHERE ${livres}`;
			break;
		}
	}
	const params =
		acao === 'add-etiqueta' || acao === 'remover-etiqueta'
			? [valor!, ...valoresId, valor!]
			: acao === 'definir-disciplina'
				? [valor!, valor!, ...valoresId, valor!]
				: valoresId;
	const r = await db().prepare(sql).bind(...params).run();
	if (chaves.length) await apagarImagensSemUso(chaves);
	return r.meta.changes;
}
