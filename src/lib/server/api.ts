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
