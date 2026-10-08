import { nomeDoProfessor } from '#lib/server/configuracoes';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => ({ professor: await nomeDoProfessor() });
