import { dadosDoPainel } from '#lib/server/painel';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => dadosDoPainel();
