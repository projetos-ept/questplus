// Uso: node scripts/gerar-admin.mjs <email> <senha>
// Imprime o SQL para criar o primeiro professor. A senha nunca é gravada em arquivo.
const [email, senha] = process.argv.slice(2);
if (!email || !senha) {
	console.error('Uso: node scripts/gerar-admin.mjs <email> <senha>');
	process.exit(1);
}
const enc = new TextEncoder();
const b64url = (b) => Buffer.from(b).toString('base64url');
const sal = crypto.getRandomValues(new Uint8Array(16));
const chave = await crypto.subtle.importKey('raw', enc.encode(senha), 'PBKDF2', false, ['deriveBits']);
const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: sal, iterations: 100000 }, chave, 256);
const hash = `pbkdf2$100000$${b64url(sal)}$${b64url(new Uint8Array(bits))}`;
const esc = (s) => s.replace(/'/g, "''");
console.log(`INSERT INTO usuarios (email, senha_hash, papel) VALUES ('${esc(email)}', '${hash}', 'admin');`);
