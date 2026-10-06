const enc = new TextEncoder();
const ITERACOES = 100_000; // limite do PBKDF2 no Workers
const SESSAO_SEGUNDOS = 60 * 60 * 12;

export const COOKIE_SESSAO = 'qp_sessao';
export const SESSAO_MAX_AGE = SESSAO_SEGUNDOS;

export type SessaoPayload = { sub: number; email: string; papel: string; exp: number };

const b64url = (bytes: Uint8Array) =>
	btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

const deB64url = (s: string) =>
	Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));

async function pbkdf2(senha: string, sal: Uint8Array, iteracoes: number) {
	const chave = await crypto.subtle.importKey('raw', enc.encode(senha), 'PBKDF2', false, ['deriveBits']);
	const bits = await crypto.subtle.deriveBits(
		{ name: 'PBKDF2', hash: 'SHA-256', salt: sal as BufferSource, iterations: iteracoes },
		chave,
		256
	);
	return new Uint8Array(bits);
}

function iguais(a: Uint8Array, b: Uint8Array) {
	if (a.length !== b.length) return false;
	let d = 0;
	for (let i = 0; i < a.length; i++) d |= a[i] ^ b[i];
	return d === 0;
}

/** Formato: pbkdf2$<iteracoes>$<sal b64url>$<hash b64url> */
export async function hashSenha(senha: string, iteracoes = ITERACOES) {
	const sal = crypto.getRandomValues(new Uint8Array(16));
	const hash = await pbkdf2(senha, sal, iteracoes);
	return `pbkdf2$${iteracoes}$${b64url(sal)}$${b64url(hash)}`;
}

export async function verificarSenha(senha: string, armazenado: string) {
	const [alg, it, sal, hash] = armazenado.split('$');
	if (alg !== 'pbkdf2' || !it || !sal || !hash) return false;
	const calculado = await pbkdf2(senha, deB64url(sal), Number(it));
	return iguais(calculado, deB64url(hash));
}

async function chaveHmac(segredo: string) {
	return crypto.subtle.importKey('raw', enc.encode(segredo), { name: 'HMAC', hash: 'SHA-256' }, false, [
		'sign',
		'verify'
	]);
}

export async function assinarJwt(
	dados: Omit<SessaoPayload, 'exp'>,
	segredo: string,
	agora = Date.now()
) {
	const cab = b64url(enc.encode(JSON.stringify({ alg: 'HS256', typ: 'JWT' })));
	const payload: SessaoPayload = { ...dados, exp: Math.floor(agora / 1000) + SESSAO_SEGUNDOS };
	const corpo = b64url(enc.encode(JSON.stringify(payload)));
	const assinatura = await crypto.subtle.sign('HMAC', await chaveHmac(segredo), enc.encode(`${cab}.${corpo}`));
	return `${cab}.${corpo}.${b64url(new Uint8Array(assinatura))}`;
}

export async function verificarJwt(token: string, segredo: string, agora = Date.now()) {
	const partes = token.split('.');
	if (partes.length !== 3) return null;
	const [cab, corpo, assinatura] = partes;
	try {
		const ok = await crypto.subtle.verify(
			'HMAC',
			await chaveHmac(segredo),
			deB64url(assinatura) as BufferSource,
			enc.encode(`${cab}.${corpo}`)
		);
		if (!ok) return null;
		const payload = JSON.parse(new TextDecoder().decode(deB64url(corpo))) as SessaoPayload;
		return payload.exp * 1000 > agora ? payload : null;
	} catch {
		return null;
	}
}
