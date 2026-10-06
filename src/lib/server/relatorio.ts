import { aproveitamentoPorQuestao, consolidar, nomesComEmailsDiferentes, resumir, tempoGasto, percentualDe, valida, type TentativaResumo } from '#lib/relatorio';
import type { QuestaoSnapshot } from '#lib/atividade';
import { obterAtividade, obterTentativa } from './atividades';
import { db } from './env';

type LinhaTentativa = Omit<TentativaResumo, 'turma'> & { turma_id: number; turma: string };

export async function tentativasDaAtividade(atividadeId: number, turmaId?: number): Promise<(TentativaResumo & { turma_id: number })[]> {
	const r = await db()
		.prepare(
			`SELECT t.id, t.nome, t.email, t.status, t.anulada, t.inicio_em, t.finalizada_em, t.nota, t.pontos_max, t.turma_id, tu.nome AS turma
			 FROM tentativas t JOIN turmas tu ON tu.id = t.turma_id
			 WHERE t.atividade_id = ? ${turmaId ? 'AND t.turma_id = ?' : ''} ORDER BY t.id`
		)
		.bind(...(turmaId ? [atividadeId, turmaId] : [atividadeId]))
		.all<LinhaTentativa>();
	return r.results;
}

export async function turmasComTentativas(atividadeId: number) {
	const r = await db()
		.prepare('SELECT DISTINCT tu.id, tu.nome FROM tentativas t JOIN turmas tu ON tu.id = t.turma_id WHERE t.atividade_id = ? ORDER BY tu.nome')
		.bind(atividadeId)
		.all<{ id: number; nome: string }>();
	return r.results;
}

export async function questoesDaAtividade(atividadeId: number) {
	const r = await db()
		.prepare(
			`SELECT aq.questao_id AS id, q.tipo, q.enunciado, COALESCE(aq.pontos, q.pontos) AS pontos
			 FROM atividade_questoes aq JOIN questoes q ON q.id = aq.questao_id WHERE aq.atividade_id = ? ORDER BY aq.ordem`
		)
		.bind(atividadeId)
		.all<{ id: number; tipo: string; enunciado: string; pontos: number }>();
	return r.results;
}

/** Pontos finais por tentativa e questão (uma linha por resposta; sem ler as cópias das questões). */
export async function pontosPorTentativa(ids: number[]) {
	const mapa = new Map<number, Map<number, number>>();
	if (!ids.length) return mapa;
	const r = await db()
		.prepare('SELECT tentativa_id, questao_id, pontos_final FROM respostas WHERE tentativa_id IN (SELECT value FROM json_each(?))')
		.bind(JSON.stringify(ids))
		.all<{ tentativa_id: number; questao_id: number; pontos_final: number | null }>();
	for (const x of r.results) {
		const m = mapa.get(x.tentativa_id) ?? new Map<number, number>();
		m.set(x.questao_id, x.pontos_final ?? 0);
		mapa.set(x.tentativa_id, m);
	}
	return mapa;
}

/** Tudo o que o relatório da atividade mostra, calculado só com consultas agregadas (leve para o plano gratuito). */
export async function relatorioDaAtividade(atividadeId: number, turmaId?: number) {
	const atividade = await obterAtividade(atividadeId);
	if (!atividade) return null;
	const [tentativas, turmas, questoes] = await Promise.all([tentativasDaAtividade(atividadeId, turmaId), turmasComTentativas(atividadeId), questoesDaAtividade(atividadeId)]);
	const alunos = consolidar(tentativas);
	const pontos = await pontosPorTentativa(alunos.map((a) => a.melhor.id));
	const aproveitamento = aproveitamentoPorQuestao(alunos.map((a) => ({ questoes, pontosPorQuestao: pontos.get(a.melhor.id) ?? new Map() })));
	return {
		atividade,
		turmas,
		turmaId: turmaId ?? null,
		resumo: resumir(tentativas, alunos),
		possiveisDuplicados: nomesComEmailsDiferentes(alunos),
		questoes: questoes.map((q) => ({ ...q, ...(aproveitamento.find((x) => x.id === q.id) ?? { alunos: 0, respondida: 0, emBranco: 0, aproveitamento: 0 }) })),
		alunos: alunos.map((a) => ({
			nome: a.nome,
			email: a.email,
			turma: a.turma,
			tentativas: a.tentativas,
			tentativaId: a.melhor.id,
			nota: a.melhor.nota ?? 0,
			pontosMax: a.melhor.pontos_max ?? 0,
			percentual: a.percentual,
			tempoSegundos: a.tempoSegundos,
			finalizadaEm: a.melhor.finalizada_em,
			pontosPorQuestao: questoes.map((q) => (pontos.get(a.melhor.id)?.has(q.id) ? (pontos.get(a.melhor.id)!.get(q.id) ?? 0) : null))
		}))
	};
}

// ---------- relatório de uma tentativa ----------

export async function relatorioDaTentativa(id: number) {
	const t = await obterTentativa(id);
	if (!t) return null;
	const [a, turma, resp, irmas] = await Promise.all([
		obterAtividade(t.atividade_id),
		db().prepare('SELECT nome FROM turmas WHERE id = ?').bind(t.turma_id).first<{ nome: string }>(),
		db().prepare('SELECT questao_id, resposta, pontos_auto, pontos_final FROM respostas WHERE tentativa_id = ?').bind(id).all<{ questao_id: number; resposta: string; pontos_auto: number | null; pontos_final: number | null }>(),
		tentativasDoAluno(t.atividade_id, t.email)
	]);
	const consolidado = consolidar(irmas)[0];
	type Dada = { escolha?: number; valores?: (boolean | null)[] };
	const respostas: Record<number, { resposta: Dada; pontos_auto: number | null; pontos_final: number | null }> = {};
	for (const r of resp.results) respostas[r.questao_id] = { resposta: JSON.parse(r.resposta) as Dada, pontos_auto: r.pontos_auto, pontos_final: r.pontos_final };
	const numero = irmas.filter((x) => x.id <= id).length;
	return {
		id: t.id,
		atividade: { id: a!.id, titulo: a!.titulo, codigo: a!.codigo, modo: a!.modo },
		aluno: { nome: t.nome, email: t.email, turma: turma?.nome ?? '' },
		status: t.status,
		anulada: t.anulada === 1,
		inicio_em: t.inicio_em,
		finalizada_em: t.finalizada_em,
		tempoSegundos: tempoGasto(t),
		nota: t.nota ?? 0,
		pontosMax: t.pontos_max ?? 0,
		percentual: percentualDe(t.nota, t.pontos_max),
		tentativaNumero: numero,
		tentativasTotal: irmas.length,
		melhor: !!consolidado && consolidado.melhor.id === t.id && valida({ ...t, turma: '' } as TentativaResumo),
		questoes: t.questoes as QuestaoSnapshot[],
		respostas
	};
}

async function tentativasDoAluno(atividadeId: number, email: string) {
	const r = await db()
		.prepare(
			`SELECT t.id, t.nome, t.email, t.status, t.anulada, t.inicio_em, t.finalizada_em, t.nota, t.pontos_max, tu.nome AS turma
			 FROM tentativas t JOIN turmas tu ON tu.id = t.turma_id WHERE t.atividade_id = ? AND t.email = ? AND t.anulada = 0 ORDER BY t.id`
		)
		.bind(atividadeId, email)
		.all<TentativaResumo>();
	return r.results;
}

// ---------- exportação ----------

/**
 * JSON com as tentativas completas (a cópia das questões como o aluno viu, com gabarito, mais as respostas e a correção).
 * Montado por concatenação de texto para não ler e reescrever o JSON das cópias (CPU do plano gratuito).
 */
export async function exportarResultadosJson(atividadeId: number, turmaId?: number) {
	const a = await obterAtividade(atividadeId);
	if (!a) return null;
	const where = `t.atividade_id = ? ${turmaId ? 'AND t.turma_id = ?' : ''}`;
	const args = turmaId ? [atividadeId, turmaId] : [atividadeId];
	const [linhas, resp, turma] = await Promise.all([
		db()
			.prepare(`SELECT t.id, t.nome, t.email, t.status, t.anulada, t.inicio_em, t.finalizada_em, t.nota, t.pontos_max, t.questoes, tu.nome AS turma FROM tentativas t JOIN turmas tu ON tu.id = t.turma_id WHERE ${where} ORDER BY t.id LIMIT 2000`)
			.bind(...args)
			.all<LinhaTentativa & { questoes: string }>(),
		db()
			.prepare(`SELECT r.tentativa_id, r.questao_id, r.resposta, r.pontos_auto, r.pontos_final FROM respostas r JOIN tentativas t ON t.id = r.tentativa_id WHERE ${where}`)
			.bind(...args)
			.all<{ tentativa_id: number; questao_id: number; resposta: string; pontos_auto: number | null; pontos_final: number | null }>(),
		turmaId ? db().prepare('SELECT id, nome FROM turmas WHERE id = ?').bind(turmaId).first<{ id: number; nome: string }>() : Promise.resolve(null)
	]);
	const porTentativa = new Map<number, string[]>();
	for (const r of resp.results) {
		const item = `{"questao_id":${r.questao_id},"resposta":${r.resposta},"pontos_auto":${JSON.stringify(r.pontos_auto)},"pontos_final":${JSON.stringify(r.pontos_final)}}`;
		porTentativa.set(r.tentativa_id, [...(porTentativa.get(r.tentativa_id) ?? []), item]);
	}
	const alunos = consolidar(linhas.results);
	const considerada = new Set(alunos.map((x) => x.melhor.id));
	const cabecalho = {
		formato: 'questplus-resultados',
		versao: 1,
		exportado_em: new Date().toISOString(),
		atividade: { id: a.id, titulo: a.titulo, codigo: a.codigo, modo: a.modo, tempo_total: a.tempo_total, tentativas_max: a.tentativas_max, abre_em: a.abre_em, fecha_em: a.fecha_em },
		turma,
		criterio: 'vale a maior nota de cada aluno (identificado pelo e-mail); tentativas anuladas ou em andamento não contam',
		alunos: alunos.map((x) => ({ nome: x.nome, email: x.email, turma: x.turma, tentativas: x.tentativas, tentativa_considerada: x.melhor.id, maior_nota: x.melhor.nota, pontos_max: x.melhor.pontos_max, percentual: x.percentual, tempo_segundos: x.tempoSegundos }))
	};
	const tentativas = linhas.results.map((t) => {
		const meta = { id: t.id, nome: t.nome, email: t.email, turma: t.turma, status: t.status, anulada: t.anulada === 1, considerada: considerada.has(t.id), inicio_em: t.inicio_em, finalizada_em: t.finalizada_em, tempo_segundos: tempoGasto(t), nota: t.nota, pontos_max: t.pontos_max, percentual: percentualDe(t.nota, t.pontos_max) };
		return `${JSON.stringify(meta).slice(0, -1)},"questoes":${t.questoes},"respostas":[${(porTentativa.get(t.id) ?? []).join(',')}]}`;
	});
	return `${JSON.stringify(cabecalho, null, 2).slice(0, -2)},\n  "tentativas": [\n${tentativas.join(',\n')}\n  ]\n}\n`;
}
