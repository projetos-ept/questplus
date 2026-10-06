import { listarTurmas } from '#lib/server/atividades';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => ({ turmas: await listarTurmas() });
