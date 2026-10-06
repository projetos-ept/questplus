import { json } from '@sveltejs/kit';
import { etiquetasExistentes } from '#lib/server/questoes';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async () => json({ itens: await etiquetasExistentes() });
