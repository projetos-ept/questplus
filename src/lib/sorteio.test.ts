import { describe, expect, it } from 'vitest';
import { embaralhar, sortear } from './sorteio';

const semente = (s: number) => () => ((s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296);
const itens = [
	...Array.from({ length: 10 }, (_, i) => ({ id: i, d: 'a' })),
	...Array.from({ length: 4 }, (_, i) => ({ id: 100 + i, d: 'b' })),
	...Array.from({ length: 2 }, (_, i) => ({ id: 200 + i, d: 'c' }))
];

describe('sorteio', () => {
	it('embaralhar mantém os mesmos itens e não altera a original', () => {
		const orig = [1, 2, 3, 4, 5];
		const r = embaralhar(orig, semente(1));
		expect([...r].sort()).toEqual([1, 2, 3, 4, 5]);
		expect(orig).toEqual([1, 2, 3, 4, 5]);
	});
	it('sorteia n itens distintos', () => {
		const r = sortear(itens, 7, undefined, semente(2));
		expect(r).toHaveLength(7);
		expect(new Set(r.map((x) => x.id)).size).toBe(7);
	});
	it('n maior que o total devolve tudo; n zero devolve nada', () => {
		expect(sortear(itens, 99, undefined, semente(3))).toHaveLength(16);
		expect(sortear(itens, 0)).toEqual([]);
	});
	it('com grupos, distribui por rodízio mesmo com grupos de tamanhos diferentes', () => {
		const r = sortear(itens, 9, (x) => x.d, semente(4));
		const por = (g: string) => r.filter((x) => x.d === g).length;
		expect([por('a'), por('b'), por('c')].sort()).toEqual([2, 3, 4].sort());
		expect(por('c')).toBe(2); // o menor grupo esgota e os outros seguem
		expect(r).toHaveLength(9);
	});
	it('com grupos e n pequeno, sai no máximo 1 de diferença entre grupos', () => {
		const r = sortear(itens, 6, (x) => x.d, semente(5));
		const c = ['a', 'b', 'c'].map((g) => r.filter((x) => x.d === g).length);
		expect(Math.max(...c) - Math.min(...c)).toBeLessThanOrEqual(1);
	});
});
