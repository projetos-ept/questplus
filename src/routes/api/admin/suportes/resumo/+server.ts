import { json } from '@sveltejs/kit';
import { filtrosSuportesDeParams, resumoSuportes } from '#lib/server/suportes';
import type { RequestHandler } from './$types';

/** Lista enxuta (até 500) dos textos que o filtro encontra, para o seletor da atividade. */
export const GET: RequestHandler = async ({ url }) => json({ itens: await resumoSuportes(filtrosSuportesDeParams(url.searchParams)) });
