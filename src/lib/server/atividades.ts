import { embaralhar, estadoAtividade, expirou, feedbackDoModo, gerarCodigo, montarSnapshot, prazoDaTentativa, type AtividadeValida, type Modo, type QuestaoSnapshot, type SuporteSnapshot, type TurmaValida } from '#lib/atividade';
import { imagensDe, type ImagemSuporte } from '#lib/imagens';
import { db } from './env';

// Limites do D1 gratuito: 50 consultas por invocação e 100 parâmetros por consulta.
// Por isso os vínculos entram com uma única instrução via json_each, em vez de um INSERT por linha.

function imagensDoBanco(json: string | null, legado: string | null) {
	let lista: ImagemSuporte[] = [];
	try {
		lista = json ? (JSON.parse(json) as ImagemSuporte[]) : [];
	} catch {
		lista = [];
	}
	return imagensDe({ imagens: lista, imagem_chave: legado });
}

// ---------- turmas ----------
export type TurmaLinha = TurmaValida & { id: number; criado_em: string; n_atividades?: number; n_tentativas?: number; atividades?: string[] };
type TurmaBruta = Omit<TurmaLinha, 'ativa' | 'atividades'> & { ativa: number; atividades?: string };
const turma = (r: TurmaBruta): TurmaLinha => ({ ...r, ativa: r.ativa === 1, atividades: r.atividades ? JSON.parse(r.atividades) : undefined });

export async function listarTurmas(apenasAtivas = false) {
	const r = await db()
		.prepare(
			`SELECT turmas.*,
				(SELECT COUNT(*) FROM atividade_turmas at WHERE at.turma_id = turmas.id) AS n_atividades,
				(SELECT COUNT(*) FROM tentativas t WHERE t.turma_id = turmas.id) AS n_tentativas,
				(SELECT json_group_array(titulo) FROM (SELECT a.titulo FROM atividade_turmas at JOIN atividades a ON a.id = at.atividade_id WHERE at.turma_id = turmas.id ORDER BY a.titulo LIMIT 5)) AS atividades
			 FROM turmas ${apenasAtivas ? 'WHERE ativa = 1' : ''} ORDER BY ativa DESC, nome`
		)
		.all<TurmaBruta>();
	return r.results.map(turma);
}

export async function criarTurma(t: TurmaValida) {
	const r = await db()
		.prepare('INSERT INTO turmas (nome, curso, periodo, ativa) VALUES (?, ?, ?, ?) RETURNING id')
		.bind(t.nome, t.curso, t.periodo, t.ativa ? 1 : 0)
		.first<{ id: number }>();
	return r!.id;
}

export async function atualizarTurma(id: number, t: TurmaValida) {
	const r = await db()
		.prepare('UPDATE turmas SET nome = ?, curso = ?, periodo = ?, ativa = ? WHERE id = ?')
		.bind(t.nome, t.curso, t.periodo, t.ativa ? 1 : 0, id)
		.run();
	return r.meta.changes > 0;
}

export type ResultadoExclusaoTurma =
	| { status: 'ok' }
	| { status: 'inexistente' }
	/** Há tentativas de alunos: excluir apagaria o histórico, então só inativar. */
	| { status: 'com-tentativas'; tentativas: number }
	/** Está em atividades e o professor não pediu para desvincular. */
	| { status: 'em-atividades'; atividades: string[]; total: number }
	/** Desvincular deixaria estas atividades sem nenhuma turma (os alunos não conseguiriam entrar). */
	| { status: 'ficaria-sem-turma'; atividades: string[] };

/**
 * Exclui a turma só pelo caminho seguro: com tentativas de alunos nunca exclui (o histórico aponta para ela); em atividades,
 * só com `desvincular` e se nenhuma atividade ficar sem turma. O DELETE final reconfere as tentativas, contra corrida.
 */
export async function excluirTurma(id: number, desvincular: boolean): Promise<ResultadoExclusaoTurma> {
	const t = await db().prepare('SELECT id FROM turmas WHERE id = ?').bind(id).first();
	if (!t) return { status: 'inexistente' };
	const tent = (await db().prepare('SELECT COUNT(*) AS n FROM tentativas WHERE turma_id = ?').bind(id).first<{ n: number }>())!.n;
	if (tent > 0) return { status: 'com-tentativas', tentativas: tent };
	const uso = await db()
		.prepare('SELECT a.id, a.titulo, (SELECT COUNT(*) FROM atividade_turmas o WHERE o.atividade_id = a.id) AS turmas FROM atividade_turmas at JOIN atividades a ON a.id = at.atividade_id WHERE at.turma_id = ? ORDER BY a.titulo')
		.bind(id)
		.all<{ id: number; titulo: string; turmas: number }>();
	if (uso.results.length) {
		if (!desvincular) return { status: 'em-atividades', atividades: uso.results.slice(0, 5).map((x) => x.titulo), total: uso.results.length };
		const orfas = uso.results.filter((x) => x.turmas <= 1);
		if (orfas.length) return { status: 'ficaria-sem-turma', atividades: orfas.slice(0, 5).map((x) => x.titulo) };
	}
	await db().batch([
		db().prepare('DELETE FROM atividade_turmas WHERE turma_id = ? AND NOT EXISTS (SELECT 1 FROM tentativas WHERE turma_id = ?)').bind(id, id),
		db().prepare('DELETE FROM turmas WHERE id = ? AND NOT EXISTS (SELECT 1 FROM tentativas WHERE turma_id = ?)').bind(id, id)
	]);
	const resta = await db().prepare('SELECT id FROM turmas WHERE id = ?').bind(id).first();
	return resta ? { status: 'com-tentativas', tentativas: 1 } : { status: 'ok' };
}

export async function definirTurmaAtiva(id: number, ativa: boolean) {
	const r = await db().prepare('UPDATE turmas SET ativa = ? WHERE id = ?').bind(ativa ? 1 : 0, id).run();
	return r.meta.changes > 0;
}

// ---------- atividades ----------
export type AtividadeLinha = {
	id: number;
	titulo: string;
	codigo: string;
	ativa: boolean;
	modo: Modo;
	tempo_total: number | null;
	tempo_por_questao: number | null;
	tentativas_max: number | null;
	feedback: 'imediato' | 'final' | 'nenhum';
	navegacao: 'livre' | 'sequencial';
	embaralhar: boolean;
	conta_nota: boolean;
	mostra_nota: boolean;
	abre_em: string | null;
	fecha_em: string | null;
	suporte_id: number | null;
	componente_id: number | null;
	/** Nome do componente curricular (junção); null = sem componente. */
	componente: string | null;
	criado_em: string;
	atualizado_em: string;
};
type AtividadeBruta = Omit<AtividadeLinha, 'ativa' | 'embaralhar' | 'conta_nota' | 'mostra_nota'> & { ativa: number; embaralhar: number; conta_nota: number; mostra_nota: number };
const atividade = (r: AtividadeBruta): AtividadeLinha => ({ ...r, ativa: r.ativa === 1, embaralhar: r.embaralhar === 1, conta_nota: r.conta_nota === 1, mostra_nota: r.mostra_nota === 1 });

export async function listarAtividades() {
	const r = await db()
		.prepare(
			`SELECT a.*, (SELECT nome FROM componentes c WHERE c.id = a.componente_id) AS componente,
				(SELECT COUNT(*) FROM atividade_questoes q WHERE q.atividade_id = a.id) AS n_questoes,
				(SELECT COUNT(*) FROM tentativas t WHERE t.atividade_id = a.id) AS n_tentativas,
				(SELECT json_group_array(json_object('id', tu.id, 'nome', tu.nome, 'ativa', tu.ativa)) FROM atividade_turmas at JOIN turmas tu ON tu.id = at.turma_id WHERE at.atividade_id = a.id) AS turmas
			 FROM atividades a ORDER BY a.id DESC`
		)
		.all<AtividadeBruta & { n_questoes: number; n_tentativas: number; turmas: string | null }>();
	return r.results.map((x) => ({
		...atividade(x),
		n_questoes: x.n_questoes,
		n_tentativas: x.n_tentativas,
		turmas: (x.turmas ? (JSON.parse(x.turmas) as { id: number; nome: string; ativa: number }[]) : []).map((t) => ({ id: t.id, nome: t.nome, ativa: t.ativa === 1 })),
		estado: estadoAtividade(atividade(x))
	}));
}

export async function obterAtividade(id: number) {
	const a = await db().prepare('SELECT a.*, (SELECT nome FROM componentes c WHERE c.id = a.componente_id) AS componente FROM atividades a WHERE a.id = ?').bind(id).first<AtividadeBruta>();
	return a ? atividade(a) : null;
}

export async function obterAtividadePorCodigo(codigo: string) {
	const a = await db().prepare('SELECT a.*, (SELECT nome FROM componentes c WHERE c.id = a.componente_id) AS componente FROM atividades a WHERE a.codigo = ?').bind(codigo).first<AtividadeBruta>();
	return a ? atividade(a) : null;
}

export async function detalhesAtividade(id: number) {
	const [questoes, turmas] = await db().batch([
		db()
			.prepare(
				`SELECT aq.questao_id, aq.ordem, aq.pontos, q.enunciado, q.tipo, q.pontos AS pontos_padrao, q.ativa
				 FROM atividade_questoes aq JOIN questoes q ON q.id = aq.questao_id
				 WHERE aq.atividade_id = ? ORDER BY aq.ordem`
			)
			.bind(id),
		db().prepare('SELECT turma_id FROM atividade_turmas WHERE atividade_id = ?').bind(id)
	]);
	return {
		questoes: (questoes.results as { questao_id: number; ordem: number; pontos: number | null; enunciado: string; tipo: string; pontos_padrao: number; ativa: number }[]).map((q) => ({ ...q, ativa: q.ativa === 1 })),
		turmas: (turmas.results as { turma_id: number }[]).map((t) => t.turma_id)
	};
}

export async function turmasDaAtividade(id: number) {
	const r = await db()
		.prepare('SELECT t.id, t.nome FROM atividade_turmas at JOIN turmas t ON t.id = at.turma_id WHERE at.atividade_id = ? AND t.ativa = 1 ORDER BY t.nome')
		.bind(id)
		.all<{ id: number; nome: string }>();
	return r.results;
}

/** Confere se as questões existem e se as novas (não vinculadas antes) estão ativas; e se as turmas existem. */
export async function conferirVinculos(v: AtividadeValida, atividadeId: number | null) {
	const ids = JSON.stringify(v.questoes.map((q) => q.questao_id));
	const [q, t, antes, sup, comp] = await db().batch([
		db().prepare('SELECT id, ativa FROM questoes WHERE id IN (SELECT value FROM json_each(?))').bind(ids),
		db().prepare('SELECT id FROM turmas WHERE id IN (SELECT value FROM json_each(?))').bind(JSON.stringify(v.turmas)),
		db().prepare('SELECT questao_id FROM atividade_questoes WHERE atividade_id = ?').bind(atividadeId ?? -1),
		db().prepare('SELECT id FROM suportes WHERE id = ?').bind(v.suporte_id ?? -1),
		db().prepare('SELECT id FROM componentes WHERE id = ?').bind(v.componente_id ?? -1)
	]);
	const erros: string[] = [];
	const existentes = new Map((q.results as { id: number; ativa: number }[]).map((x) => [x.id, x.ativa === 1]));
	const jaVinculadas = new Set((antes.results as { questao_id: number }[]).map((x) => x.questao_id));
	for (const { questao_id } of v.questoes) {
		if (!existentes.has(questao_id)) erros.push(`A questão #${questao_id} não existe.`);
		else if (!existentes.get(questao_id) && !jaVinculadas.has(questao_id)) erros.push(`A questão #${questao_id} está inativa e não pode entrar em atividades novas.`);
	}
	if (t.results.length !== v.turmas.length) erros.push('Alguma turma escolhida não existe.');
	if (v.suporte_id !== null && sup.results.length === 0) erros.push('O texto de apoio escolhido não existe.');
	if (v.componente_id !== null && comp.results.length === 0) erros.push('O componente curricular escolhido não existe.');
	return erros;
}

const vinculosQuestoes = (v: AtividadeValida) =>
	JSON.stringify(v.questoes.map((q, i) => ({ q: q.questao_id, o: i, p: q.pontos })));

const sqlQuestoes = `INSERT INTO atividade_questoes (atividade_id, questao_id, ordem, pontos)
	SELECT ?, json_extract(j.value, '$.q'), json_extract(j.value, '$.o'), json_extract(j.value, '$.p') FROM json_each(?) j`;
const sqlTurmas = 'INSERT INTO atividade_turmas (atividade_id, turma_id) SELECT ?, value FROM json_each(?)';

const codigoDuplicado = (e: unknown) => e instanceof Error && /UNIQUE constraint failed: atividades\.codigo/i.test(e.message);

/** Devolve { id } ou { erro } (código já usado). Sem código informado, sorteia um livre. */
export async function criarAtividade(v: AtividadeValida): Promise<{ id: number; codigo: string } | { erro: string }> {
	for (let tentativa = 0; tentativa < 5; tentativa++) {
		const codigo = v.codigo ?? gerarCodigo();
		try {
			const r = await db()
				.prepare(
					`INSERT INTO atividades (titulo, codigo, ativa, modo, tempo_total, tentativas_max, feedback, navegacao, embaralhar, conta_nota, mostra_nota, abre_em, fecha_em, suporte_id, componente_id)
					 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`
				)
				.bind(v.titulo, codigo, v.ativa ? 1 : 0, v.modo, v.tempo_total, v.tentativas_max, feedbackDoModo(v.modo), v.navegacao, v.embaralhar ? 1 : 0, v.modo === 'prova' ? 1 : 0, v.mostra_nota ? 1 : 0, v.abre_em, v.fecha_em, v.suporte_id, v.componente_id)
				.first<{ id: number }>();
			const id = r!.id;
			await db().batch([db().prepare(sqlQuestoes).bind(id, vinculosQuestoes(v)), db().prepare(sqlTurmas).bind(id, JSON.stringify(v.turmas))]);
			return { id, codigo };
		} catch (e) {
			if (!codigoDuplicado(e)) throw e;
			if (v.codigo) return { erro: 'Este código já está em uso por outra atividade.' };
		}
	}
	return { erro: 'Não foi possível gerar um código livre. Tente de novo.' };
}

export async function atualizarAtividade(id: number, v: AtividadeValida): Promise<'ok' | 'inexistente' | { erro: string }> {
	const atual = await obterAtividade(id);
	if (!atual) return 'inexistente';
	try {
		await db().batch([
			db()
				.prepare(
					`UPDATE atividades SET titulo = ?, codigo = ?, ativa = ?, modo = ?, tempo_total = ?, tentativas_max = ?, feedback = ?, navegacao = ?,
					 embaralhar = ?, conta_nota = ?, mostra_nota = ?, abre_em = ?, fecha_em = ?, suporte_id = ?, componente_id = ?, atualizado_em = datetime('now') WHERE id = ?`
				)
				.bind(v.titulo, v.codigo ?? atual.codigo, v.ativa ? 1 : 0, v.modo, v.tempo_total, v.tentativas_max, feedbackDoModo(v.modo), v.navegacao, v.embaralhar ? 1 : 0, v.modo === 'prova' ? 1 : 0, v.mostra_nota ? 1 : 0, v.abre_em, v.fecha_em, v.suporte_id, v.componente_id, id),
			db().prepare('DELETE FROM atividade_questoes WHERE atividade_id = ?').bind(id),
			db().prepare('DELETE FROM atividade_turmas WHERE atividade_id = ?').bind(id),
			db().prepare(sqlQuestoes).bind(id, vinculosQuestoes(v)),
			db().prepare(sqlTurmas).bind(id, JSON.stringify(v.turmas))
		]);
		return 'ok';
	} catch (e) {
		if (codigoDuplicado(e)) return { erro: 'Este código já está em uso por outra atividade.' };
		throw e;
	}
}

export async function definirAtividadeAtiva(id: number, ativa: boolean) {
	const r = await db()
		.prepare("UPDATE atividades SET ativa = ?, atualizado_em = datetime('now') WHERE id = ?")
		.bind(ativa ? 1 : 0, id)
		.run();
	return r.meta.changes > 0;
}

export async function listarTentativasDaAtividade(id: number) {
	const r = await db()
		.prepare(
			`SELECT t.id, t.nome, t.email, t.status, t.nota, t.pontos_max, t.inicio_em, t.finalizada_em, t.anulada, t.prazo_em, t.acrescimo_segundos, tu.nome AS turma
			 FROM tentativas t JOIN turmas tu ON tu.id = t.turma_id WHERE t.atividade_id = ? ORDER BY t.id DESC LIMIT 500`
		)
		.bind(id)
		.all<{ id: number; nome: string; email: string; status: string; nota: number | null; pontos_max: number | null; inicio_em: string; finalizada_em: string | null; anulada: number; prazo_em: string | null; acrescimo_segundos: number; turma: string }>();
	return r.results;
}

// ---------- tentativas (aluno) ----------
export type TentativaLinha = {
	id: number;
	atividade_id: number;
	token: string;
	nome: string;
	turma_id: number;
	email: string;
	inicio_em: string;
	prazo_em: string | null;
	acrescimo_segundos: number;
	questoes: QuestaoSnapshot[];
	/** Cópia do texto de apoio da atividade (antes da questão 1); null = atividade sem apoio. */
	suporte: SuporteSnapshot | null;
	status: 'andamento' | 'finalizada';
	finalizada_em: string | null;
	nota: number | null;
	pontos_max: number | null;
	anulada: number;
};

const novoToken = () => {
	const b = crypto.getRandomValues(new Uint8Array(32));
	return btoa(String.fromCharCode(...b)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

export async function contarTentativasDoAluno(atividadeId: number, email: string) {
	const r = await db().prepare('SELECT COUNT(*) AS n FROM tentativas WHERE atividade_id = ? AND email = ? AND anulada = 0').bind(atividadeId, email).first<{ n: number }>();
	return r!.n;
}

export async function turmaPermitida(atividadeId: number, turmaId: number) {
	const r = await db()
		.prepare('SELECT 1 AS x FROM atividade_turmas at JOIN turmas t ON t.id = at.turma_id WHERE at.atividade_id = ? AND at.turma_id = ? AND t.ativa = 1')
		.bind(atividadeId, turmaId)
		.first();
	return r !== null;
}

export async function iniciarTentativa(a: AtividadeLinha, aluno: { nome: string; turma_id: number; email: string }) {
	const linhas = await db()
		.prepare(
			`SELECT q.id, q.tipo, q.enunciado, q.config, q.explicacao, COALESCE(aq.pontos, q.pontos) AS pontos
			 FROM atividade_questoes aq JOIN questoes q ON q.id = aq.questao_id
			 WHERE aq.atividade_id = ? ORDER BY aq.ordem`
		)
		.bind(a.id)
		.all<{ id: number; tipo: string; enunciado: string; config: string; explicacao: string | null; pontos: number }>();

	let questoes = linhas.results.map((l) =>
		montarSnapshot({ id: l.id, tipo: l.tipo, enunciado: l.enunciado, config: JSON.parse(l.config), explicacao: l.explicacao, pontos: l.pontos }, a.embaralhar)
	);
	// o texto de apoio é da atividade: a tentativa guarda uma cópia (as edições do texto depois não mudam provas já feitas)
	const sup = a.suporte_id
		? await db().prepare('SELECT titulo, texto, imagem_chave, imagens FROM suportes WHERE id = ?').bind(a.suporte_id).first<{ titulo: string; texto: string; imagem_chave: string | null; imagens: string | null }>()
		: null;
	const suporte = sup ? { titulo: sup.titulo, texto: sup.texto, imagens: imagensDoBanco(sup.imagens, sup.imagem_chave) } : null;
	if (a.embaralhar) questoes = embaralhar(questoes);

	const agora = Date.now();
	const token = novoToken();
	const r = await db()
		.prepare(
			'INSERT INTO tentativas (atividade_id, token, nome, turma_id, email, inicio_em, prazo_em, questoes, pontos_max, suporte) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id'
		)
		.bind(
			a.id,
			token,
			aluno.nome,
			aluno.turma_id,
			aluno.email,
			new Date(agora).toISOString(),
			prazoDaTentativa(agora, a.tempo_total, a.fecha_em),
			JSON.stringify(questoes),
			questoes.reduce((s, q) => s + q.pontos, 0),
			suporte ? JSON.stringify(suporte) : null
		)
		.first<{ id: number }>();
	return { id: r!.id, token };
}

export async function obterTentativa(id: number): Promise<TentativaLinha | null> {
	const r = await db().prepare('SELECT * FROM tentativas WHERE id = ?').bind(id).first<Omit<TentativaLinha, 'questoes' | 'suporte'> & { questoes: string; suporte: string | null }>();
	return r ? { ...r, questoes: JSON.parse(r.questoes), suporte: r.suporte ? (JSON.parse(r.suporte) as SuporteSnapshot) : null } : null;
}

export type RespostaLinha = { questao_id: number; resposta: unknown; pontos_auto: number | null; pontos_final: number | null; status: string };

export async function respostasDaTentativa(id: number) {
	const r = await db()
		.prepare('SELECT questao_id, resposta, pontos_auto, pontos_final, status FROM respostas WHERE tentativa_id = ?')
		.bind(id)
		.all<Omit<RespostaLinha, 'resposta'> & { resposta: string }>();
	return r.results.map((x) => ({ ...x, resposta: JSON.parse(x.resposta) as unknown }));
}

/**
 * Grava a resposta. Com `travar`, a primeira resposta vale e as seguintes são ignoradas (atômico, resiste a
 * clique duplo); devolve false quando já havia resposta. Sem `travar`, a nova substitui a anterior.
 */
export async function gravarResposta(tentativaId: number, questaoId: number, resposta: unknown, pontos: number | null, travar: boolean) {
	const conflito = travar
		? 'DO NOTHING'
		: 'DO UPDATE SET resposta = excluded.resposta, pontos_auto = excluded.pontos_auto, pontos_final = excluded.pontos_final, status = excluded.status';
	// pontos null = questão aberta: fica "pendente" até o professor confirmar o nível
	const r = await db()
		.prepare(
			`INSERT INTO respostas (tentativa_id, questao_id, resposta, pontos_auto, pontos_final, status) VALUES (?, ?, ?, ?, ?, ?)
			 ON CONFLICT (tentativa_id, questao_id) ${conflito}`
		)
		.bind(tentativaId, questaoId, JSON.stringify(resposta), pontos, pontos, pontos === null ? 'pendente' : 'corrigida')
		.run();
	return r.meta.changes > 0;
}

/** Soma os pontos finais e fecha a tentativa. Idempotente: não reabre nem recalcula uma já finalizada. */
export async function finalizarTentativa(id: number) {
	await db()
		.prepare(
			`UPDATE tentativas SET status = 'finalizada', finalizada_em = ?,
				nota = COALESCE((SELECT SUM(pontos_final) FROM respostas WHERE tentativa_id = tentativas.id), 0)
			 WHERE id = ? AND status = 'andamento'`
		)
		.bind(new Date().toISOString(), id)
		.run();
	return obterTentativa(id);
}

// ---------- ações do professor sobre uma tentativa ----------

/** Encerra a tentativa e a tira da contagem de tentativas do aluno, para ele poder refazer (ex.: falha de conexão). */
export async function anularTentativa(id: number) {
	const r = await db()
		.prepare("UPDATE tentativas SET anulada = 1, status = 'finalizada', finalizada_em = COALESCE(finalizada_em, ?) WHERE id = ?")
		.bind(new Date().toISOString(), id)
		.run();
	return r.meta.changes > 0;
}

/** Soma minutos ao tempo de uma tentativa em andamento (ex.: atendimento educacional especializado). */
export async function acrescentarTempo(id: number, minutos: number): Promise<'ok' | 'inexistente' | 'sem-limite' | 'encerrada'> {
	const t = await obterTentativa(id);
	if (!t) return 'inexistente';
	if (t.prazo_em === null) return 'sem-limite';
	if (t.status !== 'andamento' || t.anulada === 1 || expirou(t.prazo_em, t.acrescimo_segundos)) return 'encerrada';
	await db().prepare('UPDATE tentativas SET acrescimo_segundos = acrescimo_segundos + ? WHERE id = ? AND status = ?').bind(minutos * 60, id, 'andamento').run();
	return 'ok';
}

// ---------- clonar e excluir atividade ----------

/** Cópia inativa, sem datas e com código novo; mantém questões (com pontos próprios), turmas e as opções do modo. */
export async function clonarAtividade(id: number): Promise<{ id: number; codigo: string } | { erro: string } | null> {
	const a = await obterAtividade(id);
	if (!a) return null;
	const det = await detalhesAtividade(id);
	const prefixo = 'Cópia de ';
	return criarAtividade({
		titulo: (prefixo + a.titulo).slice(0, 200),
		codigo: null,
		ativa: false,
		modo: a.modo,
		tempo_total: a.tempo_total,
		tentativas_max: a.tentativas_max,
		navegacao: a.navegacao,
		embaralhar: a.embaralhar,
		mostra_nota: a.mostra_nota,
		abre_em: null,
		fecha_em: null,
		suporte_id: a.suporte_id,
		componente_id: a.componente_id,
		questoes: det.questoes.map((q) => ({ questao_id: q.questao_id, pontos: q.pontos })),
		turmas: det.turmas
	});
}

/**
 * Exclui a atividade. Com tentativas, só apaga se `comTentativas` (apaga também as respostas dos alunos);
 * caso contrário devolve quantas existem, para a tela pedir a confirmação reforçada.
 */
export async function excluirAtividade(id: number, comTentativas: boolean): Promise<'ok' | 'inexistente' | { tentativas: number }> {
	if (!(await obterAtividade(id))) return 'inexistente';
	const n = (await db().prepare('SELECT COUNT(*) AS n FROM tentativas WHERE atividade_id = ?').bind(id).first<{ n: number }>())!.n;
	if (n > 0 && !comTentativas) return { tentativas: n };
	await db().batch([
		db().prepare('DELETE FROM correcoes_abertas WHERE tentativa_id IN (SELECT id FROM tentativas WHERE atividade_id = ?)').bind(id),
		db().prepare('DELETE FROM respostas WHERE tentativa_id IN (SELECT id FROM tentativas WHERE atividade_id = ?)').bind(id),
		db().prepare('DELETE FROM tentativas WHERE atividade_id = ?').bind(id),
		db().prepare('DELETE FROM atividade_questoes WHERE atividade_id = ?').bind(id),
		db().prepare('DELETE FROM atividade_turmas WHERE atividade_id = ?').bind(id),
		db().prepare('DELETE FROM atividades WHERE id = ?').bind(id)
	]);
	return 'ok';
}
