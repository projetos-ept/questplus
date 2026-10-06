import { listarSuportes } from '#lib/server/questoes';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => ({
	suportes: (await listarSuportes()).map(({ id, titulo }) => ({ id, titulo }))
});
