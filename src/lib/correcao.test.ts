import { describe, expect, it } from 'vitest';
import { corrigir, validarResposta } from './correcao';

const mc = { alternativas: ['a', 'b', 'c', 'd'], correta: 2 };
const vf = { afirmacoes: [{ texto: 'x', valor: true }, { texto: 'y', valor: false }, { texto: 'z', valor: true }, { texto: 'w', valor: false }] };

describe('MC', () => {
	it('é tudo ou nada', () => {
		expect(corrigir('mc', mc, { escolha: 2 }, 3)).toMatchObject({ pontos: 3, acertou: 'sim', gabarito: { correta: 2 } });
		expect(corrigir('mc', mc, { escolha: 0 }, 3)).toMatchObject({ pontos: 0, acertou: 'nao' });
	});
	it('recusa escolha fora do intervalo', () => {
		expect(validarResposta('mc', mc, { escolha: 4 }).ok).toBe(false);
		expect(validarResposta('mc', mc, { escolha: '2' }).ok).toBe(false);
		expect(validarResposta('mc', mc, null).ok).toBe(false);
		expect(validarResposta('mc', mc, { escolha: 3 }).ok).toBe(true);
	});
});

describe('VF', () => {
	it('é proporcional e erro não desconta', () => {
		expect(corrigir('vf', vf, { valores: [true, false, true, false] }, 4)).toMatchObject({ pontos: 4, acertou: 'sim' });
		expect(corrigir('vf', vf, { valores: [true, false, false, true] }, 4)).toMatchObject({ pontos: 2, acertou: 'parcial' });
		expect(corrigir('vf', vf, { valores: [false, true, false, true] }, 4)).toMatchObject({ pontos: 0, acertou: 'nao' });
	});
	it('em branco não pontua e arredonda a 2 casas', () => {
		expect(corrigir('vf', vf, { valores: [true, null, null, null] }, 1)).toMatchObject({ pontos: 0.25 });
		const tres = { afirmacoes: vf.afirmacoes.slice(0, 3) };
		expect(corrigir('vf', tres, { valores: [true, false, true] }, 1).pontos).toBe(1);
		expect(corrigir('vf', tres, { valores: [true, true, true] }, 1).pontos).toBe(0.67);
	});
	it('valida tamanho e tipos', () => {
		expect(validarResposta('vf', vf, { valores: [true] }).ok).toBe(false);
		expect(validarResposta('vf', vf, { valores: [true, 'f', true, false] }).ok).toBe(false);
		expect(validarResposta('vf', vf, { valores: [true, null, true, false] }).ok).toBe(true);
	});
});
