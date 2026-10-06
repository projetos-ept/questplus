# QuestPlus

Atividades e provas pelo celular, correção automática, correção de abertas por IA e relatório impresso. Tudo no Cloudflare (plano gratuito). Especificação completa em [`Sistema de Atividades documentação do projeto.md`](<Sistema de Atividades documentação do projeto.md>).

## Estado

- **Fase 1 (base)**: SvelteKit no Pages, D1, login do professor (JWT + PBKDF2). Em produção.
- **Fase 2 (banco de questões)**: cadastro de MC4, MC5 e VF, textos de apoio em Markdown seguro, upload de imagem para o R2, filtros por formato, etiqueta, situação e busca. Tabelas `suportes` e `questoes` e bucket R2 `questplus-midia` criados no Cloudflare; binding `MEDIA` configurado em `wrangler.jsonc`.

- **Fase 3 (atividades e modo Treino)**: turmas, atividades com código/link, prazo e situação, tela do aluno pelo celular, correção automática de MC e VF, gabarito e explicação logo após cada resposta, tentativa retomável ao recarregar. Tabelas de `migrations/0003_atividades.sql` criadas no Cloudflare.

**Link da atividade (como no Google Forms):** cada atividade tem um código, sorteado por padrão (6 caracteres sem letras ambíguas) e personalizável (4 a 20 letras, números ou hífens, sem diferenciar maiúsculas; `admin` e `midia` são reservados). O link curto é `/CODIGO`, que redireciona para `/a/CODIGO`. Há botão de copiar na lista de atividades e logo após criar.

**Regras que a Fase 3 já aplica (e a Fase 4 reaproveita):** o gabarito nunca vai ao aluno antes da hora; a tentativa guarda uma cópia das questões, então editar a questão depois não altera provas feitas; cada tentativa tem token próprio (cabeçalho `x-tentativa-token`); o prazo é validado no servidor (tolerância de 5 s) e a tentativa vencida é encerrada na próxima consulta. Colunas de tempo, limite de tentativas e feedback já existem em `atividades`, mas a tela só cria atividades do modo Treino.

- **Fase 4 (modo Prova)**: a atividade tem modo **Treino** ou **Prova**. Prova: tempo total (medido no servidor), número de tentativas (padrão 1, ajustável ou ilimitado), navegação livre ou sequencial, embaralhamento, **nunca mostra o gabarito** ao aluno e, opcionalmente, **mostra a nota** no final. As respostas da Prova são salvas sozinhas. O professor pode **anular** uma tentativa (o aluno pode refazer; não conta no limite) e **acrescentar tempo**; vale a **maior nota** do aluno (marcada no painel). Exige `migrations/0004_modo_prova.sql` no banco antes de publicar.
- **Exclusão de questão** com modal de confirmação (recusa se a questão está em alguma atividade; provas já feitas guardam cópia e não são afetadas).
- **Aluno:** barra de progresso "Questão X de N" e mensagens de encerramento por modo (Treino: incentivo a refazer até acertar tudo; Prova: tentativas restantes e "aguarde o retorno detalhado do professor").

As demais fases seguem a tabela da documentação.

> Atenção ao escrever mensagens de commit: o Cloudflare Pages pula o build se a mensagem contiver a expressão de pular CI entre colchetes, **mesmo citada em uma frase** (isso já aconteceu aqui). Só use essa expressão quando quiser mesmo pular o deploy.

**Tema:** o padrão é sempre o **claro**, para aluno e professor, independentemente do tema do sistema; o botão troca para o escuro e a escolha fica salva no navegador. As cores são variáveis CSS em `src/routes/+layout.svelte`; use sempre `var(--...)`, nunca cor fixa.

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
5b. **Fase 2 e 3:** aplicar também `migrations/0003_atividades.sql`; a extensão só aceita instruções que venham do chat, então cole o SQL na conversa dela (ver `docs/roteiro-extensao-fase2-3.md`).
5c. **Fase 2:** criar o bucket R2 `questplus-midia` (sem acesso público) e as tabelas de `migrations/0002_banco_questoes.sql` (uma instrução por vez no console do D1). Só depois adicionar o binding R2 `MEDIA` → `questplus-midia` ao `wrangler.jsonc` (`r2_buckets`) e publicar; com o binding apontando para um bucket inexistente o deploy falha. Sem o binding, o resto funciona e o upload responde 503 com mensagem clara.
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
| `src/lib/server/questoes.ts`, `src/lib/server/atividades.ts` | Consultas ao D1 (vínculos em lote com `json_each`, por causa do limite de 50 consultas e 100 parâmetros) |
| `src/lib/correcao.ts`, `src/lib/atividade.ts` | Correção de MC e VF, estado e prazo da atividade, cópia da questão para a tentativa, validações |
| `src/routes/a/[codigo]`, `src/routes/[codigo]` | Tela do aluno e link curto |
| `src/routes/api/tentativas` | API pública do aluno: iniciar, ler, responder, finalizar (protegida pelo token da tentativa) |
| `src/routes/api/admin/{turmas,atividades}` | API do painel; `PUT /atividades/[id]/situacao` é o interruptor manual |
| `migrations/` | Migrações do D1 |
| `scripts/gerar-admin.mjs` | Gera o SQL do primeiro professor |
