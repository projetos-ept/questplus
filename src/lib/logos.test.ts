import { describe, expect, it } from 'vitest';
import { LIMITE_LOGOS, TAMANHO_MAX_LOGO, nomeDoArquivo, validarNomeLogo } from './logos';

describe('logos', () => {
	it('limites: até 6 logos de 1 MB', () => {
		expect(LIMITE_LOGOS).toBe(6);
		expect(TAMANHO_MAX_LOGO).toBe(1024 * 1024);
	});
	it('nome: 2 a 60 caracteres, espaços limpos, vazio usa o padrão', () => {
		expect(validarNomeLogo('  Escola   Modelo ', 'x')).toEqual({ ok: true, valor: 'Escola Modelo' });
		expect(validarNomeLogo('', 'logo-escola')).toEqual({ ok: true, valor: 'logo-escola' });
		expect(validarNomeLogo(undefined, 'padrao')).toEqual({ ok: true, valor: 'padrao' });
		expect(validarNomeLogo('a', 'x').ok).toBe(false);
		expect(validarNomeLogo('x'.repeat(61), 'x').ok).toBe(false);
		expect(validarNomeLogo('', 'y'.repeat(80))).toEqual({ ok: true, valor: 'y'.repeat(60) });
	});
	it('nome sugerido vem do arquivo sem a extensão', () => {
		expect(nomeDoArquivo('logo-escola.png')).toBe('logo-escola');
		expect(nomeDoArquivo('a.b.webp')).toBe('a.b');
		expect(nomeDoArquivo('.png')).toBe('Logo');
	});
});
