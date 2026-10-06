import { json, redirect } from '@sveltejs/kit';
import type { Handle } from '@sveltejs/kit/hooks';
import { COOKIE_SESSAO, verificarJwt } from '#lib/server/auth';
import { segredoJwt } from '#lib/server/env';

export const handle: Handle = async ({ event, resolve }) => {
	const token = event.cookies.get(COOKIE_SESSAO);
	const sessao = token ? await verificarJwt(token, segredoJwt()) : null;
	event.locals.usuario = sessao ? { id: sessao.sub, email: sessao.email, papel: sessao.papel } : null;

	const { pathname } = event.url;
	if (!event.locals.usuario) {
		if (pathname.startsWith('/api/admin')) return json({ erro: 'não autenticado' }, { status: 401 });
		if (pathname.startsWith('/admin') && pathname !== '/admin/login') redirect(303, '/admin/login');
	}

	return resolve(event);
};
