import { corrigir } from '#lib/correcao';
import { expirou, versaoAluno } from '#lib/atividade';
import { erros, iguais } from './api';
import { contarTentativasDoAluno, finalizarTentativa, obterAtividade, obterTentativa, respostasDaTentativa, type AtividadeLinha, type TentativaLinha } from './atividades';

export const CABECALHO_TOKEN = 'x-tentativa-token';

type Autenticada = { t: TentativaLinha; a: AtividadeLinha } | { resposta: Response };

/** Carrega a tentativa, confere o token e encerra sozinha a que passou do prazo. 404 serve para id ruim e token ruim. */
export async function autenticar(request: Request, idBruto: string): Promise<Autenticada> {
	const id = Number(idBruto);
	const token = request.headers.get(CABECALHO_TOKEN) ?? '';
	const t = Number.isInteger(id) && id > 0 ? await obterTentativa(id) : null;
	if (!t || !iguais(token, t.token)) return { resposta: erros(['Tentativa não encontrada.'], 404) };
	const a = (await obterAtividade(t.atividade_id))!;
	if (t.status === 'andamento' && expirou(t.prazo_em, t.acrescimo_segundos)) {
		return { t: (await finalizarTentativa(t.id))!, a };
	}
	return { t, a };
}

export const prazoEfetivo = (t: TentativaLinha) =>
	t.prazo_em ? new Date(Date.parse(t.prazo_em) + t.acrescimo_segundos * 1000).toISOString() : null;

/** Estado que o aluno recebe. Gabarito e explicação só aparecem quando a atividade permite. */
export async function montarEstado(t: TentativaLinha, a: AtividadeLinha) {
	const mostrar = a.feedback === 'imediato' || (t.status === 'finalizada' && a.feedback !== 'nenhum');
	const porId = new Map(t.questoes.map((q) => [q.id, q]));
	const respostas: Record<number, { resposta: unknown; pendente?: boolean; feedback?: ReturnType<typeof corrigir> & { explicacao: string | null } }> = {};
	for (const r of await respostasDaTentativa(t.id)) {
		const q = porId.get(r.questao_id);
		if (!q) continue;
		respostas[r.questao_id] = {
			resposta: r.resposta,
			...(q.tipo === 'aberta' && { pendente: r.status === 'pendente' }),
			...(mostrar && q.tipo !== 'aberta' && { feedback: { ...corrigir(q.tipo, q.config, r.resposta as never, q.pontos), explicacao: q.explicacao } })
		};
	}
	return {
		id: t.id,
		status: t.status,
		agora: new Date().toISOString(),
		prazo_em: prazoEfetivo(t),
		atividade: { titulo: a.titulo, modo: a.modo, feedback: a.feedback, navegacao: a.navegacao },
		// quantas tentativas o aluno já usou (sem as anuladas) e o limite, para a mensagem de encerramento
		tentativas: { usadas: await contarTentativasDoAluno(t.atividade_id, t.email), max: a.tentativas_max },
		// o texto de apoio da atividade (cópia guardada na tentativa), mostrado antes da questão 1
		suporte: t.suporte,
		questoes: t.questoes.map(versaoAluno),
		respostas,
		// a nota aparece com o gabarito (Treino) ou, na Prova, quando o professor liberou; o gabarito nunca depende disto
		resultado: t.status === 'finalizada' && t.anulada === 0 && (mostrar || a.mostra_nota) ? { nota: t.nota ?? 0, pontos_max: t.pontos_max ?? 0, abertas_pendentes: Object.values(respostas).filter((r) => r.pendente).length } : null
	};
}
