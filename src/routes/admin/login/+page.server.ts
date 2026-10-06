import { fail, redirect } from '@sveltejs/kit';
import { COOKIE_SESSAO, SESSAO_MAX_AGE, assinarJwt, hashSenha, verificarSenha } from '#lib/server/auth';
import { db, limiteConfigurado, segredoJwt } from '#lib/server/env';
import { chaveDoIp, consumir, usos, zerar } from '#lib/server/limite';
import type { Actions, PageServerLoad } from './$types';

const JANELA_LOGIN_MS = 60 * 60 * 1000;

type Usuario = { id: number; email: string; senha_hash: string; papel: string };

// hash de uma senha qualquer, usado para gastar o mesmo tempo quando o e-mail não existe
const hashFalso = hashSenha('questplus-sem-usuario');

export const load: PageServerLoad = ({ locals }) => {
	if (locals.usuario) redirect(303, '/admin');
};

export const actions: Actions = {
	default: async ({ request, cookies, url, getClientAddress }) => {
		const dados = await request.formData();
		const email = String(dados.get('email') ?? '').trim();
		const senha = String(dados.get('senha') ?? '');
		if (!email || !senha) return fail(400, { email, erro: 'Informe e-mail e senha.' });

		// Freio contra tentativa e erro: por endereço de rede (o mais importante) e por e-mail (contra tentativas vindas de
		// vários endereços). As chaves são hashes; nem o IP nem o e-mail ficam gravados. Pedido bloqueado nem chega ao PBKDF2.
		let ip: string | null = null;
		try {
			ip = request.headers.get('cf-connecting-ip') ?? getClientAddress();
		} catch {
			ip = null;
		}
		const chaveIp = ip ? `login:ip:${await chaveDoIp(ip)}` : null;
		const chaveEmail = `login:email:${await chaveDoIp(`email:${email.toLowerCase()}`)}`;
		const limiteIp = limiteConfigurado('LIMITE_LOGIN_FALHAS_IP_HORA', 10);
		const limiteEmail = limiteConfigurado('LIMITE_LOGIN_FALHAS_EMAIL_HORA', 50);
		const agora = Date.now();
		if ((chaveIp && (await usos(chaveIp, agora, JANELA_LOGIN_MS)) >= limiteIp) || (await usos(chaveEmail, agora, JANELA_LOGIN_MS)) >= limiteEmail) {
			return fail(429, { email, erro: 'Muitas tentativas de login. Aguarde cerca de 1 hora e tente de novo.' });
		}

		const usuario = await db()
			.prepare('SELECT id, email, senha_hash, papel FROM usuarios WHERE email = ?')
			.bind(email)
			.first<Usuario>();

		const ok = await verificarSenha(senha, usuario?.senha_hash ?? (await hashFalso));
		if (!usuario || !ok) {
			if (chaveIp) await consumir(chaveIp, limiteIp, agora, JANELA_LOGIN_MS);
			await consumir(chaveEmail, limiteEmail, agora, JANELA_LOGIN_MS);
			return fail(401, { email, erro: 'E-mail ou senha incorretos.' });
		}
		if (chaveIp) await zerar(chaveIp); // entrou: quem só errou a digitação não fica penalizado
		await zerar(chaveEmail);

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
