import { json } from '@sveltejs/kit';
import { facetasQuestoes, filtrosDeParams } from '#lib/server/questoes';
import type { RequestHandler } from './$types';

/** Contagens por disciplina, formato, etiqueta e apoio, para os filtros mostrarem quantas questões cada opção traz. */
export const GET: RequestHandler = async ({ url }) => json(await facetasQuestoes(filtrosDeParams(url.searchParams)));
