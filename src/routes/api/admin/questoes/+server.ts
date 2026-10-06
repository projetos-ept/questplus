import { json } from '@sveltejs/kit';
import { validarQuestao } from '#lib/questao';
import { corpoJson, erros } from '#lib/server/api';
import { criarQuestao, listarQuestoes, suporteExiste } from '#lib/server/questoes';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url }) => {
	const p = url.searchParams;
	const ativa = p.get('ativa');
	return json(
		await listarQuestoes({
			tipo: p.get('tipo') || undefined,
			etiqueta: p.get('etiqueta') || undefined,
			ativa: ativa === null || ativa === '' ? undefined : ativa === '1' || ativa === 'true',
			q: p.get('q') || undefined,
			limite: Number(p.get('limite')) || undefined,
			offset: Number(p.get('offset')) || undefined
		})
	);
};

export const POST: RequestHandler = async ({ request }) => {
	const r = validarQuestao(await corpoJson(request));
	if (!r.ok) return erros(r.erros);
	if (r.valor.suporte_id && !(await suporteExiste(r.valor.suporte_id))) return erros(['Texto de apoio não encontrado.']);
	return json({ id: await criarQuestao(r.valor) }, { status: 201 });
};
