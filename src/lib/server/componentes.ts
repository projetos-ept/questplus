import { db } from './env';

export type ComponenteLinha = { id: number; nome: string; n_atividades: number };

export async function listarComponentes() {
	const r = await db()
		.prepare('SELECT c.id, c.nome, (SELECT COUNT(*) FROM atividades a WHERE a.componente_id = c.id) AS n_atividades FROM componentes c ORDER BY c.nome COLLATE NOCASE')
		.all<ComponenteLinha>();
	return r.results;
}

const duplicado = (e: unknown) => e instanceof Error && /UNIQUE constraint failed: componentes\.nome/i.test(e.message);

export async function criarComponente(nome: string): Promise<{ id: number } | { erro: string }> {
	try {
		const r = await db().prepare('INSERT INTO componentes (nome) VALUES (?) RETURNING id').bind(nome).first<{ id: number }>();
		return { id: r!.id };
	} catch (e) {
		if (duplicado(e)) return { erro: 'Já existe um componente curricular com este nome.' };
		throw e;
	}
}

export async function renomearComponente(id: number, nome: string): Promise<'ok' | 'inexistente' | { erro: string }> {
	try {
		const r = await db().prepare('UPDATE componentes SET nome = ? WHERE id = ?').bind(nome, id).run();
		return r.meta.changes > 0 ? 'ok' : 'inexistente';
	} catch (e) {
		if (duplicado(e)) return { erro: 'Já existe um componente curricular com este nome.' };
		throw e;
	}
}

/**
 * Exclui o componente. Em uso por atividades só com `desvincular` (as atividades ficam sem componente);
 * sem isso devolve quantas usam, para a tela pedir a confirmação.
 */
export async function excluirComponente(id: number, desvincular: boolean): Promise<'ok' | 'inexistente' | { em_uso: number; atividades: string[] }> {
	const existe = await db().prepare('SELECT id FROM componentes WHERE id = ?').bind(id).first();
	if (!existe) return 'inexistente';
	const uso = await db().prepare('SELECT titulo FROM atividades WHERE componente_id = ? ORDER BY titulo').bind(id).all<{ titulo: string }>();
	if (uso.results.length && !desvincular) return { em_uso: uso.results.length, atividades: uso.results.slice(0, 5).map((x) => x.titulo) };
	await db().batch([db().prepare('UPDATE atividades SET componente_id = NULL WHERE componente_id = ?').bind(id), db().prepare('DELETE FROM componentes WHERE id = ?').bind(id)]);
	return 'ok';
}
