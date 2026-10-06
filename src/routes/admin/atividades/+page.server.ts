import { listarAtividades } from '#lib/server/atividades';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => ({ atividades: await listarAtividades() });
