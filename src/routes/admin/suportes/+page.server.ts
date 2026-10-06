import { listarSuportes } from '#lib/server/questoes';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => ({ itens: await listarSuportes() });
