import { json } from '@sveltejs/kit';
import { estadoAtividade, validarInicio } from '#lib/atividade';
import { corpoJson, erros } from '#lib/server/api';
import { contarTentativasDoAluno, iniciarTentativa, obterAtividadePorCodigo, turmaPermitida } from '#lib/server/atividades';
import { limiteConfigurado } from '#lib/server/env';
import { chaveDoIp, consumir, usos } from '#lib/server/limite';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, getClientAddress }) => {
	const r = validarInicio(await corpoJson(request));
	if (!r.ok) return erros(r.erros);
	const { codigo, nome, turma_id, email } = r.valor;

	// Proteção contra abuso: o endereço de rede vem do Cloudflare (o aluno não consegue forjar). Sem endereço, não limita.
	let ip: string | null = null;
	try {
		ip = request.headers.get('cf-connecting-ip') ?? getClientAddress();
	} catch {
		ip = null;
	}
	const chaveIp = ip ? await chaveDoIp(ip) : null;
	const limitePalpites = limiteConfigurado('LIMITE_PALPITES_IP_DIA', 50);
	if (chaveIp && (await usos(`palpite:${chaveIp}`)) >= limitePalpites) {
		return erros(['Muitas tentativas com código ou turma incorretos a partir desta rede. Tente de novo mais tarde (até 24 horas) ou peça ajuda ao professor.'], 429);
	}
	const errouPalpite = async () => {
		if (chaveIp) await consumir(`palpite:${chaveIp}`, limitePalpites);
	};

	const a = await obterAtividadePorCodigo(codigo);
	const estado = a ? estadoAtividade(a) : 'inativa';
	if (!a || estado === 'inativa') {
		await errouPalpite();
		return erros(['Código não encontrado.'], 404);
	}
	if (estado === 'antes') return erros(['Esta atividade ainda não abriu.'], 403);
	if (estado === 'encerrada') return erros(['O prazo desta atividade acabou.'], 403);

	if (!(await turmaPermitida(a.id, turma_id))) {
		await errouPalpite();
		return erros(['Esta turma não pode responder esta atividade.'], 403);
	}
	if (a.tentativas_max !== null && (await contarTentativasDoAluno(a.id, email)) >= a.tentativas_max) {
		return erros(['Você já usou todas as tentativas desta atividade.'], 409);
	}
	// Uma turma inteira costuma sair do mesmo endereço de rede da escola: o limite é por atividade, para uma não bloquear a outra.
	if (chaveIp && !(await consumir(`inicio:${chaveIp}:${a.id}`, limiteConfigurado('LIMITE_INICIOS_IP_ATIVIDADE_DIA', 200)))) {
		return erros(['Esta rede atingiu o limite de tentativas desta atividade nas últimas 24 horas. Se vários alunos usam a mesma rede, avise o professor.'], 429);
	}
	return json(await iniciarTentativa(a, { nome, turma_id, email }), { status: 201 });
};
