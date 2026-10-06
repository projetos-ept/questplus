import { alertasDe, conferirConceitos, conferirOposicoes, cosseno, nivelValido, percentualDe, pontosDoNivel, similaridadeTexto, triar, type Alerta, type Nivel } from '#lib/aberta';
import type { Aberta } from '#lib/questao';
import { obterTentativa } from './atividades';
import { db } from './env';
import { FalhaIA, modeloUsado, nivelPelaIA, vetores } from './ia';
import { questoesDaAtividade } from './relatorio';

export type LinhaAberta = {
	tentativa_id: number;
	questao_id: number;
	nome: string;
	email: string;
	turma: string;
	texto: string;
	status: 'pendente' | 'corrigida';
	triagem: string | null;
	nivel_ia: number | null;
	aproximacao: number | null;
	conceitos: { presentes: string[]; faltantes: string[] } | null;
	erro_conceitual: boolean;
	justificativa: string | null;
	alertas: Alerta[];
	falha: string | null;
	nivel_final: number | null;
	confirmado_em: string | null;
	confirmado_por: string | null;
	pontos_final: number | null;
};

type Bruta = Omit<LinhaAberta, 'texto' | 'conceitos' | 'erro_conceitual' | 'alertas'> & { resposta: string; conceitos: string | null; erro_conceitual: number | null; alertas: string | null };

const LIMITE_COPIA = 0.9;
const MAX_PARA_COPIA = 60;

/** Respostas abertas das tentativas finalizadas (válidas) de uma atividade, agrupadas por questão. */
export async function filaDaAtividade(atividadeId: number) {
	const abertas = (await questoesDaAtividade(atividadeId)).filter((q) => q.tipo === 'aberta');
	if (!abertas.length) return { questoes: [], emAndamento: 0 };
	const r = await db()
		.prepare(
			`SELECT r.tentativa_id, r.questao_id, r.resposta, r.status, r.pontos_final, t.nome, t.email, tu.nome AS turma,
				c.triagem, c.nivel_ia, c.aproximacao, c.conceitos, c.erro_conceitual, c.justificativa, c.alertas, c.falha, c.nivel_final, c.confirmado_em, c.confirmado_por
			 FROM respostas r
			 JOIN tentativas t ON t.id = r.tentativa_id
			 JOIN turmas tu ON tu.id = t.turma_id
			 LEFT JOIN correcoes_abertas c ON c.tentativa_id = r.tentativa_id AND c.questao_id = r.questao_id
			 WHERE t.atividade_id = ? AND t.status = 'finalizada' AND t.anulada = 0
			   AND r.questao_id IN (SELECT questao_id FROM atividade_questoes WHERE atividade_id = ?)
			 ORDER BY t.nome COLLATE NOCASE, t.id`
		)
		.bind(atividadeId, atividadeId)
		.all<Bruta>();
	const andamento = await db()
		.prepare("SELECT COUNT(*) AS n FROM tentativas WHERE atividade_id = ? AND status = 'andamento'")
		.bind(atividadeId)
		.first<{ n: number }>();

	const ids = new Set(abertas.map((q) => q.id));
	const linhas: LinhaAberta[] = r.results
		.filter((x) => ids.has(x.questao_id))
		.map((x) => ({
			...x,
			texto: String((JSON.parse(x.resposta) as { texto?: string }).texto ?? ''),
			conceitos: x.conceitos ? JSON.parse(x.conceitos) : null,
			erro_conceitual: x.erro_conceitual === 1,
			alertas: x.alertas ? JSON.parse(x.alertas) : []
		}));

	const questoes = abertas.map((q) => {
		const itens = linhas.filter((l) => l.questao_id === q.id);
		// cópia entre alunos: só vale a pena comparar um conjunto razoável
		if (itens.length > 1 && itens.length <= MAX_PARA_COPIA) {
			const copiou = new Set<number>();
			for (let i = 0; i < itens.length; i++) {
				for (let j = i + 1; j < itens.length; j++) {
					if (itens[i].email.toLowerCase() === itens[j].email.toLowerCase()) continue;
					if (similaridadeTexto(itens[i].texto, itens[j].texto) >= LIMITE_COPIA) (copiou.add(i), copiou.add(j));
				}
			}
			for (const i of copiou) itens[i].alertas = [...itens[i].alertas, ...alertasDe({ nivel: null, aproximacao: null, oposicoes: [], copia: true })];
		}
		return { id: q.id, enunciado: q.enunciado, pontos: q.pontos, itens };
	});
	return { questoes, emAndamento: andamento?.n ?? 0 };
}

/** Quantas respostas abertas ainda esperam confirmação, por atividade (para avisos nas listas). */
export async function pendentesPorAtividade(): Promise<Map<number, number>> {
	const r = await db()
		.prepare(
			`SELECT t.atividade_id AS id, COUNT(*) AS n FROM respostas r JOIN tentativas t ON t.id = r.tentativa_id
			 WHERE r.status = 'pendente' AND t.status = 'finalizada' AND t.anulada = 0 GROUP BY t.atividade_id`
		)
		.all<{ id: number; n: number }>();
	return new Map(r.results.map((x) => [x.id, x.n]));
}

type Contexto = { t: NonNullable<Awaited<ReturnType<typeof obterTentativa>>>; q: { id: number; enunciado: string; pontos: number; config: Aberta }; texto: string; confirmada: boolean };

async function carregar(tentativaId: number, questaoId: number): Promise<Contexto | { erro: string; status: number }> {
	const t = await obterTentativa(tentativaId);
	if (!t) return { erro: 'Tentativa não encontrada.', status: 404 };
	if (t.status !== 'finalizada') return { erro: 'A tentativa ainda está em andamento; corrija depois que o aluno finalizar.', status: 409 };
	if (t.anulada) return { erro: 'Esta tentativa foi anulada.', status: 409 };
	const q = t.questoes.find((x) => x.id === questaoId);
	if (!q || q.tipo !== 'aberta') return { erro: 'Questão aberta não encontrada nesta tentativa.', status: 404 };
	const r = await db().prepare('SELECT resposta FROM respostas WHERE tentativa_id = ? AND questao_id = ?').bind(tentativaId, questaoId).first<{ resposta: string }>();
	if (!r) return { erro: 'O aluno não respondeu esta questão.', status: 404 };
	const c = await db().prepare('SELECT confirmado_em FROM correcoes_abertas WHERE tentativa_id = ? AND questao_id = ?').bind(tentativaId, questaoId).first<{ confirmado_em: string | null }>();
	return {
		t,
		q: { id: q.id, enunciado: q.enunciado, pontos: q.pontos, config: q.config as Aberta },
		texto: String((JSON.parse(r.resposta) as { texto?: string }).texto ?? ''),
		confirmada: !!c?.confirmado_em
	};
}

const agora = () => new Date().toISOString();

/** Grava o nível final, passa a resposta para "corrigida" e refaz a nota da tentativa (tudo em um lote atômico). */
async function aplicarNivel(ctx: Contexto, nivel: Nivel, por: string) {
	const pontos = pontosDoNivel(nivel, ctx.q.pontos, ctx.q.config);
	await db().batch([
		db()
			.prepare(
				`INSERT INTO correcoes_abertas (tentativa_id, questao_id, nivel_final, confirmado_em, confirmado_por) VALUES (?, ?, ?, ?, ?)
				 ON CONFLICT (tentativa_id, questao_id) DO UPDATE SET nivel_final = excluded.nivel_final, confirmado_em = excluded.confirmado_em, confirmado_por = excluded.confirmado_por`
			)
			.bind(ctx.t.id, ctx.q.id, nivel, agora(), por),
		db().prepare("UPDATE respostas SET pontos_final = ?, status = 'corrigida' WHERE tentativa_id = ? AND questao_id = ?").bind(pontos, ctx.t.id, ctx.q.id),
		db()
			.prepare("UPDATE tentativas SET nota = COALESCE((SELECT SUM(pontos_final) FROM respostas WHERE tentativa_id = tentativas.id), 0) WHERE id = ? AND status = 'finalizada'")
			.bind(ctx.t.id)
	]);
	return pontos;
}

export type ResultadoCorrecao =
	| { ok: true; tipo: 'triagem'; motivo: string; nivel: 0 }
	| { ok: true; tipo: 'ia'; nivel: number; aproximacao: number; alertas: Alerta[] }
	| { ok: false; falha: string; status?: number };

/** Triagem por regra e, se passar, IA (nível) + embeddings (aproximação). A nota só muda quando o professor confirma, exceto na triagem (nota 0). */
export async function corrigirAberta(tentativaId: number, questaoId: number): Promise<ResultadoCorrecao> {
	const ctx = await carregar(tentativaId, questaoId);
	if ('erro' in ctx) return { ok: false, falha: ctx.erro, status: ctx.status };
	if (ctx.confirmada) return { ok: false, falha: 'Esta resposta já foi confirmada. Ajuste o nível manualmente, se for o caso.', status: 409 };
	const { q, texto } = ctx;

	const tri = triar(texto, q.enunciado, q.config);
	if (!tri.ok) {
		await db()
			.prepare(
				`INSERT INTO correcoes_abertas (tentativa_id, questao_id, triagem, nivel_ia, corrigida_em) VALUES (?, ?, ?, 0, ?)
				 ON CONFLICT (tentativa_id, questao_id) DO UPDATE SET triagem = excluded.triagem, nivel_ia = 0, falha = NULL, corrigida_em = excluded.corrigida_em`
			)
			.bind(tentativaId, questaoId, tri.motivo, agora())
			.run();
		await aplicarNivel(ctx, 0, 'triagem');
		return { ok: true, tipo: 'triagem', motivo: tri.motivo, nivel: 0 };
	}

	const evidencia = conferirConceitos(texto, q.config);
	const oposicoes = conferirOposicoes(texto, q.config);
	try {
		const [{ saida, modelo, versao }, vs] = await Promise.all([
			nivelPelaIA({ enunciado: q.enunciado, cfg: q.config, resposta: texto, evidencia, alertasOposicao: oposicoes.map((o) => `a referência usa "${o.lado_referencia}" e o aluno usa "${o.lado_oposto}"`) }),
			vetores([q.config.referencia, texto])
		]);
		const aproximacao = percentualDe(cosseno(vs[0], vs[1]));
		const alertas = alertasDe({ nivel: saida.nivel, aproximacao, oposicoes });
		if (saida.erro_conceitual && !alertas.some((a) => a.codigo === 'possivel_oposicao')) {
			alertas.push({ codigo: 'parecido_mas_erro', texto: 'O modelo apontou erro conceitual. Leia a justificativa.' });
		}
		await db()
			.prepare(
				`INSERT INTO correcoes_abertas (tentativa_id, questao_id, triagem, nivel_ia, aproximacao, conceitos, erro_conceitual, justificativa, alertas, falha, modelo, versao_prompt, corrigida_em)
				 VALUES (?, ?, NULL, ?, ?, ?, ?, ?, ?, NULL, ?, ?, ?)
				 ON CONFLICT (tentativa_id, questao_id) DO UPDATE SET triagem = NULL, nivel_ia = excluded.nivel_ia, aproximacao = excluded.aproximacao, conceitos = excluded.conceitos,
					erro_conceitual = excluded.erro_conceitual, justificativa = excluded.justificativa, alertas = excluded.alertas, falha = NULL, modelo = excluded.modelo,
					versao_prompt = excluded.versao_prompt, corrigida_em = excluded.corrigida_em`
			)
			.bind(tentativaId, questaoId, saida.nivel, aproximacao, JSON.stringify({ presentes: saida.conceitos_presentes, faltantes: saida.conceitos_faltantes }), saida.erro_conceitual ? 1 : 0, saida.justificativa, JSON.stringify(alertas), modelo, versao, agora())
			.run();
		return { ok: true, tipo: 'ia', nivel: saida.nivel, aproximacao, alertas };
	} catch (e) {
		if (!(e instanceof FalhaIA)) throw e;
		await db()
			.prepare(
				`INSERT INTO correcoes_abertas (tentativa_id, questao_id, falha, modelo, corrigida_em) VALUES (?, ?, ?, ?, ?)
				 ON CONFLICT (tentativa_id, questao_id) DO UPDATE SET falha = excluded.falha, modelo = excluded.modelo, corrigida_em = excluded.corrigida_em`
			)
			.bind(tentativaId, questaoId, e.message, modeloUsado(), agora())
			.run();
		return { ok: false, falha: e.message };
	}
}

/** O professor confirma (ou ajusta) o nível: só aqui a nota da questão aberta passa a valer. */
export async function confirmarAberta(tentativaId: number, questaoId: number, nivel: unknown, por: string) {
	if (!nivelValido(nivel)) return { ok: false as const, erro: 'Escolha um nível de 0 a 4.', status: 400 };
	const ctx = await carregar(tentativaId, questaoId);
	if ('erro' in ctx) return { ok: false as const, erro: ctx.erro, status: ctx.status };
	const pontos = await aplicarNivel(ctx, nivel, por);
	return { ok: true as const, pontos, max: ctx.q.pontos };
}
