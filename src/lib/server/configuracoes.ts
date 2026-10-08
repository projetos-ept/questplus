import { db } from './env';

const CHAVE_PROFESSOR = 'professor_nome';

/** Nome do professor que sai nos relatórios (um só para o sistema). Sem a tabela ainda criada, devolve null em vez de quebrar o relatório. */
export async function nomeDoProfessor(): Promise<string | null> {
	try {
		const r = await db().prepare('SELECT valor FROM configuracoes WHERE chave = ?').bind(CHAVE_PROFESSOR).first<{ valor: string }>();
		return r?.valor || null;
	} catch {
		return null;
	}
}

/** `null` (ou vazio) apaga o nome: os relatórios voltam a sair sem a linha do professor. */
export async function definirNomeDoProfessor(nome: string | null) {
	if (nome === null) await db().prepare('DELETE FROM configuracoes WHERE chave = ?').bind(CHAVE_PROFESSOR).run();
	else await db().prepare('INSERT INTO configuracoes (chave, valor) VALUES (?, ?) ON CONFLICT(chave) DO UPDATE SET valor = excluded.valor').bind(CHAVE_PROFESSOR, nome).run();
}
