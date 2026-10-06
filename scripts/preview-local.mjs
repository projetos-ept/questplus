// Roda o site localmente (wrangler pages dev) sem o binding "ai", que exige conta Cloudflare e rede.
// A correção por IA fica indisponível, ou simulada com IA_FAKE=1 em .dev.vars. O wrangler.jsonc é restaurado ao sair.
import { copyFileSync, readFileSync, writeFileSync } from 'node:fs';
import { spawn } from 'node:child_process';

const original = readFileSync('wrangler.jsonc', 'utf8');
copyFileSync('wrangler.jsonc', 'wrangler.jsonc.bak');
writeFileSync('wrangler.jsonc', original.replace(/^\s*"ai":.*\n/m, ''));
const restaurar = () => { try { copyFileSync('wrangler.jsonc.bak', 'wrangler.jsonc'); } catch {} };
process.on('exit', restaurar);
for (const s of ['SIGINT', 'SIGTERM']) process.on(s, () => process.exit(0));
const porta = process.argv[2] ?? '8788';
spawn('npx', ['wrangler', 'pages', 'dev', '.svelte-kit/cloudflare', '--port', porta], { stdio: 'inherit' });
