import { json } from '@sveltejs/kit';
import { corrigir, validarResposta, type RespostaMc, type RespostaVf } from '#lib/correcao';
import { corpoJson, erros, idDe } from '#lib/server/api';
import { gravarResposta } from '#lib/server/atividades';
import { autenticar } from '#lib/server/tentativa';
import type { RequestHandler } from './$types';

export const PUT: RequestHandler = async ({ request, params }) => {
	const auth = await autenticar(request, params.id);
	if ('resposta' in auth) return auth.resposta;
	const { t, a } = auth;
	if (t.status !== 'andamento') return erros(['O tempo acabou ou a tentativa já foi finalizada.'], 409);

	const qid = idDe(params.questao);
	const q = t.questoes.find((x) => x.id === qid);
	if (!q) return erros(['Questão não encontrada nesta tentativa.'], 404);

	const corpo = (await corpoJson(request)) as { resposta?: unknown } | undefined;
	const v = validarResposta(q.tipo, q.config, corpo?.resposta);
	if (!v.ok) return erros([v.erro]);

	const imediato = a.feedback === 'imediato';

	// Questão aberta: a resposta fica pendente até o professor confirmar o nível; nunca há gabarito nem nota na hora.
	if (q.tipo === 'aberta') {
		if (!(await gravarResposta(t.id, q.id, v.valor, null, imediato))) return erros(['Esta questão já foi respondida.'], 409);
		return json({ ok: true, ...(imediato && { pendente: true }) });
	}

	const correcao = corrigir(q.tipo, q.config, v.valor as RespostaMc | RespostaVf, q.pontos);
	// resposta imediata trava a questão: uma afirmação em branco travaria o aluno sem querer
	if (imediato && 'valores' in v.valor && v.valor.valores.some((x) => x === null)) {
		return erros(['Marque verdadeiro ou falso em todas as afirmações antes de responder.']);
	}
	if (!(await gravarResposta(t.id, q.id, v.valor, correcao.pontos, imediato))) {
		return erros(['Esta questão já foi respondida.'], 409);
	}
	return json({ ok: true, ...(imediato && { feedback: { ...correcao, explicacao: q.explicacao } }) });
};
