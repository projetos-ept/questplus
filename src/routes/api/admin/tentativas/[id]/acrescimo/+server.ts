import { json } from '@sveltejs/kit';
import { corpoJson, erros, idDe } from '#lib/server/api';
import { acrescentarTempo } from '#lib/server/atividades';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ params, request }) => {
	const id = idDe(params.id);
	const corpo = (await corpoJson(request)) as { minutos?: unknown } | undefined;
	const minutos = Number(corpo?.minutos);
	if (!id) return erros(['Tentativa não encontrada.'], 404);
	if (!Number.isInteger(minutos) || minutos < 1 || minutos > 240) return erros(['Informe de 1 a 240 minutos.']);
	const r = await acrescentarTempo(id, minutos);
	if (r === 'inexistente') return erros(['Tentativa não encontrada.'], 404);
	if (r === 'sem-limite') return erros(['Esta atividade não tem limite de tempo.'], 409);
	if (r === 'encerrada') return erros(['A tentativa já terminou. Anule-a para o aluno poder refazer.'], 409);
	return json({ id, minutos });
};
