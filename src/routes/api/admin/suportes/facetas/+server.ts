import { json } from '@sveltejs/kit';
import { facetasSuportes, filtrosSuportesDeParams } from '#lib/server/suportes';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url }) => json(await facetasSuportes(filtrosSuportesDeParams(url.searchParams)));
