/** Embaralha (Fisher–Yates) uma cópia da lista. `rnd` permite testar com números fixos. */
export function embaralhar<T>(lista: T[], rnd: () => number = Math.random): T[] {
	const r = [...lista];
	for (let i = r.length - 1; i > 0; i--) {
		const j = Math.floor(rnd() * (i + 1));
		[r[i], r[j]] = [r[j], r[i]];
	}
	return r;
}

/**
 * Sorteia `n` itens. Com `grupoDe`, distribui por rodízio entre os grupos (ex.: disciplinas), sorteando dentro de cada um;
 * quando um grupo acaba, os outros continuam, então sempre sai `min(n, total)`.
 */
export function sortear<T>(itens: T[], n: number, grupoDe?: (x: T) => string, rnd: () => number = Math.random): T[] {
	const alvo = Math.max(0, Math.min(n, itens.length));
	if (!grupoDe) return embaralhar(itens, rnd).slice(0, alvo);
	const grupos = new Map<string, T[]>();
	for (const x of embaralhar(itens, rnd)) {
		const g = grupoDe(x);
		grupos.set(g, [...(grupos.get(g) ?? []), x]);
	}
	const filas = embaralhar([...grupos.values()], rnd);
	const saida: T[] = [];
	while (saida.length < alvo) {
		for (const f of filas) {
			const x = f.shift();
			if (x !== undefined && saida.length < alvo) saida.push(x);
		}
	}
	return saida;
}
