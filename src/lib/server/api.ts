import { json } from '@sveltejs/kit';

export async function corpoJson(request: Request): Promise<unknown> {
	try {
		return await request.json();
	} catch {
		return undefined;
	}
}

export const erros = (lista: string[], status = 400) => json({ erros: lista }, { status });

export function idDe(valor: string) {
	const n = Number(valor);
	return Number.isInteger(n) && n > 0 ? n : null;
}

/** Comparação em tempo constante, para tokens. */
export function iguais(a: string, b: string) {
	if (a.length !== b.length) return false;
	let d = 0;
	for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
	return d === 0;
}
