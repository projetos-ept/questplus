import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

/** Endereço antigo: os relatórios agora ficam em /admin/relatorios/[id]. Redireciona mantendo ?turma= e ?imprimir=1. */
export const GET: RequestHandler = ({ params, url }) => redirect(308, `/admin/relatorios/${params.id}/resumo${url.search}`);
