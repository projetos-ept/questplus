import { describe, expect, it } from 'vitest';
import { filtroDeParams, filtroVazio, filtrosAtivos, paramsDeFiltro } from './filtros';

describe('filtros combináveis na URL', () => {
	it('lê, normaliza e descarta valores inválidos', () => {
		const f = filtroDeParams(new URLSearchParams('q= ab &tipo=xx&disciplina=Hematologia&etiquetas=Coleta,coleta,tubos&ativa=9&ordem=foo'));
		expect(f).toEqual({ q: 'ab', tipo: '', disciplina: 'hematologia', etiquetas: ['coleta', 'tubos'], ativa: '', ordem: 'recentes' });
	});
	it('aceita o parâmetro antigo etiqueta', () => {
		expect(filtroDeParams(new URLSearchParams('etiqueta=Coleta')).etiquetas).toEqual(['coleta']);
	});
	it('ida e volta mantém só o que difere do padrão', () => {
		const f = { ...filtroVazio(), tipo: 'vf' as const, etiquetas: ['a', 'b'], ordem: 'pontos' as const };
		const p = paramsDeFiltro(f);
		expect(p.toString()).toBe('tipo=vf&etiquetas=a%2Cb&ordem=pontos');
		expect(filtroDeParams(p)).toEqual(f);
		expect(paramsDeFiltro(filtroVazio()).toString()).toBe('');
	});
	it('conta filtros ligados (a ordem não conta; a situação é opcional)', () => {
		expect(filtrosAtivos(filtroVazio())).toBe(0);
		expect(filtrosAtivos({ ...filtroVazio(), q: 'x', tipo: 'mc', etiquetas: ['a', 'b'], ordem: 'pontos' })).toBe(3);
		expect(filtrosAtivos({ ...filtroVazio(), ativa: '1' }, false)).toBe(0);
		expect(filtrosAtivos({ ...filtroVazio(), ativa: '1' })).toBe(1);
	});
});
