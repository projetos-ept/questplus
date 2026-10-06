import { json } from '@sveltejs/kit';
import type { Handle } from '@sveltejs/kit/hooks';
import { COOKIE_SESSAO, verificarJwt } from '#lib/server/auth';
import { segredoJwt } from '#lib/server/env';

const dentroDe = (caminho: string, base: string) => caminho === base || caminho.startsWith(`${base}/`);

/** Cabeçalhos de segurança: o painel não pode ser embutido em outro site e nada é interpretado com tipo diferente do declarado. */
const CABECALHOS: Record<string, string> = {
	'x-frame-options': 'DENY',
	'content-security-policy': "frame-ancestors 'none'",
	'x-content-type-options': 'nosniff',
	'referrer-policy': 'strict-origin-when-cross-origin',
	'permissions-policy': 'camera=(), microphone=(), geolocation=(), payment=()'
};

function comCabecalhos(resposta: Response, privado: boolean) {
	for (const [nome, valor] of Object.entries({ ...CABECALHOS, ...(privado ? { 'cache-control': 'no-store' } : {}) })) {
		try {
			if (!resposta.headers.has(nome)) resposta.headers.set(nome, valor);
		} catch {
			// resposta com cabeçalhos imutáveis (arquivo estático): já sai com os do Cloudflare
		}
	}
	return resposta;
}

export const handle: Handle = async ({ event, resolve }) => {
	const token = event.cookies.get(COOKIE_SESSAO);
	const sessao = token ? await verificarJwt(token, segredoJwt()) : null;
	event.locals.usuario = sessao ? { id: sessao.sub, email: sessao.email, papel: sessao.papel } : null;

	// Limite exato do caminho: "/administrador" é um código de atividade como outro qualquer, não a área do professor.
	const { pathname } = event.url;
	const noAdmin = dentroDe(pathname, '/admin');
	const naApiAdmin = dentroDe(pathname, '/api/admin');
	if (!event.locals.usuario) {
		if (naApiAdmin) return comCabecalhos(json({ erro: 'não autenticado' }, { status: 401 }), true);
		if (noAdmin && pathname !== '/admin/login') {
			return comCabecalhos(new Response(null, { status: 303, headers: { location: '/admin/login' } }), true);
		}
	}

	const resposta = await resolve(event);
	return comCabecalhos(resposta, noAdmin || naApiAdmin || dentroDe(pathname, '/api/tentativas'));
};
