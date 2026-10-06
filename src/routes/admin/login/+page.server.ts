import { fail, redirect } from '@sveltejs/kit';
import { COOKIE_SESSAO, SESSAO_MAX_AGE, assinarJwt, hashSenha, verificarSenha } from '#lib/server/auth';
import { db, segredoJwt } from '#lib/server/env';
import type { Actions, PageServerLoad } from './$types';

type Usuario = { id: number; email: string; senha_hash: string; papel: string };

// hash de uma senha qualquer, usado para gastar o mesmo tempo quando o e-mail não existe
const hashFalso = hashSenha('questplus-sem-usuario');

export const load: PageServerLoad = ({ locals }) => {
	if (locals.usuario) redirect(303, '/admin');
};

export const actions: Actions = {
	default: async ({ request, cookies, url }) => {
		const dados = await request.formData();
		const email = String(dados.get('email') ?? '').trim();
		const senha = String(dados.get('senha') ?? '');
		if (!email || !senha) return fail(400, { email, erro: 'Informe e-mail e senha.' });

		const usuario = await db()
			.prepare('SELECT id, email, senha_hash, papel FROM usuarios WHERE email = ?')
			.bind(email)
			.first<Usuario>();

		const ok = await verificarSenha(senha, usuario?.senha_hash ?? (await hashFalso));
		if (!usuario || !ok) return fail(401, { email, erro: 'E-mail ou senha incorretos.' });

		const token = await assinarJwt({ sub: usuario.id, email: usuario.email, papel: usuario.papel }, segredoJwt());
		cookies.set(COOKIE_SESSAO, token, {
			path: '/',
			httpOnly: true,
			sameSite: 'lax',
			secure: url.protocol === 'https:',
			maxAge: SESSAO_MAX_AGE
		});
		redirect(303, '/admin');
	}
};
