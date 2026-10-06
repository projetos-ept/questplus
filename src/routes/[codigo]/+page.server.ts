import { error, redirect } from '@sveltejs/kit';
import { CODIGO_ATIVIDADE } from '#lib/atividade';
import { obterAtividadePorCodigo } from '#lib/server/atividades';
import type { PageServerLoad } from './$types';

// Link curto, como no Google Forms: questplus.pages.dev/CODIGO. As rotas fixas (/admin, /api, /midia, /a, /r)
// têm prioridade sobre esta, e caminhos fora do formato de código nem consultam o banco.
export const load: PageServerLoad = async ({ params }) => {
	if (!CODIGO_ATIVIDADE.test(params.codigo)) error(404, 'Página não encontrada');
	const a = await obterAtividadePorCodigo(params.codigo);
	if (!a) error(404, 'Código não encontrado');
	redirect(302, `/a/${encodeURIComponent(a.codigo)}`);
};
