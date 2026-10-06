# QuestPlus

Atividades e provas pelo celular, correção automática, correção de abertas por IA e relatório impresso. Tudo no Cloudflare (plano gratuito). Especificação completa em [`Sistema de Atividades documentação do projeto.md`](<Sistema de Atividades documentação do projeto.md>).

## Estado

- **Fase 1 (base)**: SvelteKit no Pages, D1, login do professor (JWT + PBKDF2). Em produção.
- **Fase 2 (banco de questões)**: cadastro de MC4, MC5 e VF, textos de apoio em Markdown seguro, upload de imagem para o R2, filtros por formato, etiqueta, situação e busca. Código pronto e testado localmente; **depende das tabelas `suportes` e `questoes` e do bucket R2 `questplus-midia` no Cloudflare**, e do binding `MEDIA` (ver abaixo).

As demais fases seguem a tabela da documentação.

**Tema:** a interface segue o tema claro ou escuro do sistema e tem um botão para trocar à mão (a escolha fica salva no navegador). As cores são variáveis CSS em `src/routes/+layout.svelte`; use sempre `var(--...)`, nunca cor fixa.

## Desenvolvimento local

```bash
npm install
cp .dev.vars.example .dev.vars          # defina JWT_SECRET
npm run build
npx wrangler d1 migrations apply questplus --local
npx wrangler d1 execute questplus --local --command "$(node scripts/gerar-admin.mjs EMAIL SENHA)"
npx wrangler pages dev .svelte-kit/cloudflare --r2 MEDIA   # http://localhost:8788, com R2 local
```

Outros comandos: `npm test` (vitest), `npm run check` (svelte-check).

### Notas de stack (SvelteKit 3 + adapter-cloudflare 8)

- A configuração do SvelteKit fica em `vite.config.ts`; `svelte.config.js` não é mais aceito.
- `$lib` foi removido: use `#lib/...` (mapeado em `package.json` → `imports`).
- Imports de componentes usam `#lib/components/...`; o resto de `#lib/...` aponta para arquivos `.ts`.
- Não existe mais `event.platform`. Bindings e segredos vêm de `import { env } from 'cloudflare:workers'`, encapsulado em `src/lib/server/env.ts`.

## Implantação (etapas de dashboard)

Roteiro completo e autônomo para a extensão Claude in Chrome: [`docs/roteiro-extensao-chrome.md`](docs/roteiro-extensao-chrome.md). Resumo:

Só podem ser feitas no painel do Cloudflare (ou com `wrangler` autenticado):

1. Criar o banco D1 `questplus` e copiar o `database_id` para `wrangler.jsonc` (já preenchido).
2. Aplicar as migrações no banco remoto: `npm run db:migrate:remote`.
3. Criar o projeto Pages `questplus` (conectado a este repositório; build `npm run build`, saída `.svelte-kit/cloudflare`) e confirmar o endereço `questplus.pages.dev`.
4. Em Settings → Variables and Secrets, criar o **secret** `JWT_SECRET` (valor longo e aleatório; quem cola é o professor, não a automação).
5. Em Settings → Bindings, confirmar o binding D1 `DB` → `questplus`.
5b. **Fase 2:** criar o bucket R2 `questplus-midia` (sem acesso público) e as tabelas de `migrations/0002_banco_questoes.sql` (uma instrução por vez no console do D1). Só depois adicionar o binding R2 `MEDIA` → `questplus-midia` ao `wrangler.jsonc` (`r2_buckets`) e publicar; com o binding apontando para um bucket inexistente o deploy falha. Sem o binding, o resto funciona e o upload responde 503 com mensagem clara.
6. Criar o primeiro professor: gerar o SQL (pelo console do navegador, ver `docs/gerar-sql-professor.md`, ou com `node scripts/gerar-admin.mjs EMAIL SENHA`) e executá-lo no console do D1.

## Estrutura

| Caminho | Função |
| --- | --- |
| `src/hooks.server.ts` | Lê a sessão do cookie; protege `/admin` (redireciona) e `/api/admin` (401) |
| `src/lib/server/auth.ts` | PBKDF2-SHA256 (100 mil iterações) e JWT HS256, com WebCrypto |
| `src/lib/server/env.ts` | Acesso tipado aos bindings (`DB`, `JWT_SECRET`) |
| `src/routes/admin/login` | Login do professor |
| `src/routes/admin/questoes`, `src/routes/admin/suportes` | Telas do banco de questões e dos textos de apoio |
| `src/routes/api/admin/{questoes,suportes,midia}` | API JSON (exige sessão); `PATCH /questoes/[id]` ativa ou inativa |
| `src/routes/midia/[chave]` | Serve a imagem do R2 (rota aberta, chave UUID, só imagens passam pelo upload) |
| `src/lib/questao.ts` | Validação de questões e textos de apoio (compartilhada entre painel e API) |
| `src/lib/markdown.ts` | Markdown mínimo que escapa todo HTML antes de formatar |
| `src/lib/midia.ts` | Detecção de imagem pelos bytes (SVG é recusado de propósito) |
| `src/lib/server/questoes.ts` | Consultas ao D1 |
| `migrations/` | Migrações do D1 |
| `scripts/gerar-admin.mjs` | Gera o SQL do primeiro professor |
