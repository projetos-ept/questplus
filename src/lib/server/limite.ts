import { db, segredoJwt } from './env';

const JANELA_MS = 24 * 60 * 60 * 1000;
const enc = new TextEncoder();

/**
 * Chave do endereço de rede sem guardar o endereço: HMAC do IP com o segredo do sistema, só os primeiros 16 hex.
 * O sistema coleta o mínimo de dados do aluno (parte são menores de idade), então o IP não fica gravado.
 */
export async function chaveDoIp(ip: string) {
	const chave = await crypto.subtle.importKey('raw', enc.encode(segredoJwt()), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
	const mac = new Uint8Array(await crypto.subtle.sign('HMAC', chave, enc.encode(`ip:${ip}`)));
	return [...mac.slice(0, 8)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

const limiteDaJanela = (agora: number) => new Date(agora - JANELA_MS).toISOString();

/** Quantas vezes a chave já foi usada na janela atual (0 se a janela venceu ou a chave não existe). */
export async function usos(chave: string, agora = Date.now()) {
	const r = await db().prepare('SELECT n FROM limites WHERE chave = ? AND inicio >= ?').bind(chave, limiteDaJanela(agora)).first<{ n: number }>();
	return r?.n ?? 0;
}

/**
 * Conta um uso. Devolve false (sem gravar nada) quando o limite da janela de 24 h já foi atingido.
 * Janela fixa a partir do primeiro uso. Pedidos bloqueados não gravam: quem insiste não gasta a cota de escritas do D1.
 */
export async function consumir(chave: string, limite: number, agora = Date.now()): Promise<boolean> {
	const [, r] = await db().batch([
		db()
			.prepare('INSERT INTO limites (chave, inicio, n) VALUES (?, ?, 0) ON CONFLICT(chave) DO UPDATE SET n = 0, inicio = excluded.inicio WHERE limites.inicio < ?')
			.bind(chave, new Date(agora).toISOString(), limiteDaJanela(agora)),
		db().prepare('UPDATE limites SET n = n + 1 WHERE chave = ? AND n < ? RETURNING n').bind(chave, limite)
	]);
	// faxina eventual das janelas vencidas (sem agendador no plano gratuito)
	if (Math.random() < 0.02) await db().prepare('DELETE FROM limites WHERE inicio < ?').bind(limiteDaJanela(agora)).run();
	return r.results.length > 0;
}
