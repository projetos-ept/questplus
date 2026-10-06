# QuestPlus

Atividades e provas pelo celular, correção automática, correção de abertas por IA e relatório impresso. Tudo no Cloudflare (plano gratuito). Especificação completa em [`Sistema de Atividades documentação do projeto.md`](<Sistema de Atividades documentação do projeto.md>).

## Estado

**Fase 1 (base)**: SvelteKit no Pages, D1, login do professor (JWT + PBKDF2). As demais fases seguem a tabela da documentação.

## Desenvolvimento local

```bash
npm install
cp .dev.vars.example .dev.vars          # defina JWT_SECRET
npm run build
npx wrangler d1 migrations apply questplus --local
npx wrangler d1 execute questplus --local --command "$(node scripts/gerar-admin.mjs EMAIL SENHA)"
npm run preview                          # http://localhost:8788
```

Outros comandos: `npm test` (vitest), `npm run check` (svelte-check).

### Notas de stack (SvelteKit 3 + adapter-cloudflare 8)

- A configuração do SvelteKit fica em `vite.config.ts`; `svelte.config.js` não é mais aceito.
- `$lib` foi removido: use `#lib/...` (mapeado em `package.json` → `imports`).
- Não existe mais `event.platform`. Bindings e segredos vêm de `import { env } from 'cloudflare:workers'`, encapsulado em `src/lib/server/env.ts`.

## Implantação (etapas de dashboard)

Roteiro completo e autônomo para a extensão Claude in Chrome: [`docs/roteiro-extensao-chrome.md`](docs/roteiro-extensao-chrome.md). Resumo:

Só podem ser feitas no painel do Cloudflare (ou com `wrangler` autenticado):

1. Criar o banco D1 `questplus` e copiar o `database_id` para `wrangler.jsonc` (já preenchido).
2. Aplicar as migrações no banco remoto: `npm run db:migrate:remote`.
3. Criar o projeto Pages `questplus` (conectado a este repositório; build `npm run build`, saída `.svelte-kit/cloudflare`) e confirmar o endereço `questplus.pages.dev`.
4. Em Settings → Variables and Secrets, criar o **secret** `JWT_SECRET` (valor longo e aleatório; quem cola é o professor, não a automação).
5. Em Settings → Bindings, confirmar o binding D1 `DB` → `questplus`.
6. Criar o primeiro professor: gerar o SQL (pelo console do navegador, ver `docs/gerar-sql-professor.md`, ou com `node scripts/gerar-admin.mjs EMAIL SENHA`) e executá-lo no console do D1.

## Estrutura

| Caminho | Função |
| --- | --- |
| `src/hooks.server.ts` | Lê a sessão do cookie; protege `/admin` (redireciona) e `/api/admin` (401) |
| `src/lib/server/auth.ts` | PBKDF2-SHA256 (100 mil iterações) e JWT HS256, com WebCrypto |
| `src/lib/server/env.ts` | Acesso tipado aos bindings (`DB`, `JWT_SECRET`) |
| `src/routes/admin/login` | Login do professor |
| `migrations/` | Migrações do D1 |
| `scripts/gerar-admin.mjs` | Gera o SQL do primeiro professor |
