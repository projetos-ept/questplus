import { describe, expect, it } from 'vitest';
import { assinarJwt, hashSenha, verificarJwt, verificarSenha } from './auth';

describe('senha', () => {
	it('aceita a senha certa e recusa a errada', async () => {
		const h = await hashSenha('segredo-123', 1000);
		expect(await verificarSenha('segredo-123', h)).toBe(true);
		expect(await verificarSenha('outra', h)).toBe(false);
	});
	it('recusa hash malformado', async () => {
		expect(await verificarSenha('x', 'lixo')).toBe(false);
	});
});

describe('jwt', () => {
	const dados = { sub: 1, email: 'p@x.com', papel: 'professor' };
	it('valida o token assinado', async () => {
		const t = await assinarJwt(dados, 's1');
		expect((await verificarJwt(t, 's1'))?.email).toBe('p@x.com');
	});
	it('recusa segredo errado, adulteração e expiração', async () => {
		const t = await assinarJwt(dados, 's1');
		expect(await verificarJwt(t, 's2')).toBeNull();
		const [a, , c] = t.split('.');
		const falso = `${a}.${btoa(JSON.stringify({ ...dados, papel: 'admin', exp: 9e9 }))}.${c}`;
		expect(await verificarJwt(falso, 's1')).toBeNull();
		expect(await verificarJwt(t, 's1', Date.now() + 13 * 3600 * 1000)).toBeNull();
	});
});
