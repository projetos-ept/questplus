import { json } from '@sveltejs/kit';
import { estadoAtividade, validarInicio } from '#lib/atividade';
import { corpoJson, erros } from '#lib/server/api';
import { contarTentativasDoAluno, iniciarTentativa, obterAtividadePorCodigo, turmaPermitida } from '#lib/server/atividades';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request }) => {
	const r = validarInicio(await corpoJson(request));
	if (!r.ok) return erros(r.erros);
	const { codigo, nome, turma_id, email } = r.valor;

	const a = await obterAtividadePorCodigo(codigo);
	const estado = a ? estadoAtividade(a) : 'inativa';
	if (!a || estado === 'inativa') return erros(['Código não encontrado.'], 404);
	if (estado === 'antes') return erros(['Esta atividade ainda não abriu.'], 403);
	if (estado === 'encerrada') return erros(['O prazo desta atividade acabou.'], 403);

	if (!(await turmaPermitida(a.id, turma_id))) return erros(['Esta turma não pode responder esta atividade.'], 403);
	if (a.tentativas_max !== null && (await contarTentativasDoAluno(a.id, email)) >= a.tentativas_max) {
		return erros(['Você já usou todas as tentativas desta atividade.'], 409);
	}
	return json(await iniciarTentativa(a, { nome, turma_id, email }), { status: 201 });
};
