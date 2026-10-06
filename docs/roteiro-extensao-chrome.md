# Roteiro para o Claude in Chrome — implantar o QuestPlus no Cloudflare

> Cole o bloco abaixo (de "CONTEXTO" até "RELATE") na extensão. Ela não conhece o projeto.
> Os nomes de botões do dashboard mudam com o tempo: se um nome não bater, a extensão deve procurar o equivalente e avisar.

## CONTEXTO

Você vai configurar a implantação de um app chamado **questplus** na conta Cloudflare já logada neste navegador.
É um app SvelteKit que roda no **Cloudflare Pages** (Functions), usa um banco **D1** e o repositório GitHub é `projetos-ept/questplus`, branch `claude/gallant-bohr-w6rsh1` (a `main` ainda não tem o app).
Plano gratuito. Não crie nada além do que está listado. **Nunca digite segredos por conta própria**: quando chegar num campo de secret, pare e peça ao usuário para colar o valor.
Antes de qualquer ação destrutiva (apagar, sobrescrever), pergunte.

## PASSO 1 — Criar o banco D1

1. Cloudflare → Workers & Pages → D1 SQL Database (ou Storage & Databases → D1) → Create database.
2. Nome exato: `questplus`. Localização: automática.
3. Abra o banco criado e copie o **Database ID** (UUID). **Pare e entregue esse UUID ao usuário** — ele precisa ser colocado no arquivo `wrangler.jsonc` do repositório (substituindo `SUBSTITUIR_PELO_ID_DO_D1`) e enviado por push antes do PASSO 3.

## PASSO 2 — Criar a tabela de usuários

No banco `questplus` → aba Console, execute exatamente:

```sql
CREATE TABLE usuarios (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	email TEXT NOT NULL UNIQUE COLLATE NOCASE,
	senha_hash TEXT NOT NULL,
	papel TEXT NOT NULL DEFAULT 'professor' CHECK (papel IN ('professor', 'admin')),
	criado_em TEXT NOT NULL DEFAULT (datetime('now'))
);
```

Confirme que a tabela `usuarios` aparece na aba Tables. (Se o usuário rodar depois `wrangler d1 migrations apply` a partir do terminal, a migração `0001_usuarios` acusará que a tabela já existe: nesse caso use um só dos dois caminhos, nunca os dois.)

## PASSO 3 — Criar o projeto Pages (só depois de o usuário confirmar que o `database_id` foi enviado ao GitHub)

1. Workers & Pages → Create → **Pages** → Connect to Git → repositório `projetos-ept/questplus` (se a conta GitHub não estiver conectada, pare e avise).
2. Nome do projeto: `questplus` (o endereço será `questplus.pages.dev`; se o nome estiver ocupado, **pare e avise**, não escolha outro).
3. Production branch: `claude/gallant-bohr-w6rsh1`.
4. Framework preset: **None**. Build command: `npm run build`. Build output directory: `.svelte-kit/cloudflare`.
5. Environment variables (Production **e** Preview, se pedir): `NODE_VERSION` = `22.17.0` (o SvelteKit 3 exige Node 22.17 ou maior).
6. Save and Deploy. Aguarde o build; se falhar, **copie o log inteiro do build** e entregue ao usuário (não tente consertar).

## PASSO 4 — Secret e binding

1. No projeto `questplus` → Settings → Variables and Secrets (ou Environment variables) → Production → Add → tipo **Secret**, nome `JWT_SECRET`. **Pare e peça ao usuário para colar o valor** (texto longo e aleatório, 32+ caracteres). Salve.
2. Settings → Bindings: confirme que existe binding **D1 database**, nome `DB`, banco `questplus`. Se ele aparecer bloqueado/"gerenciado pelo arquivo wrangler", é o esperado (vem do `wrangler.jsonc`); se não existir, adicione com esses mesmos nomes.
3. Faça um novo deploy (Deployments → Retry deployment no último) para o secret entrar em vigor.

## PASSO 5 — Primeiro professor

O usuário vai gerar o SQL no console do navegador (veja `docs/gerar-sql-professor.md`) e colar aqui a linha `INSERT INTO usuarios ... ;` (contém só o hash, nunca a senha). Execute essa linha no Console do D1 `questplus` e confirme "1 row written". Não peça nem veja a senha.

## PASSO 6 — Teste real no navegador

1. Abra `https://questplus.pages.dev/admin` em uma aba nova: deve redirecionar para `/admin/login`.
2. Tente entrar com e-mail certo e senha errada: deve mostrar "E-mail ou senha incorretos." (se o usuário permitir, peça a ele para digitar a senha certa no campo; você não digita senhas).
3. Com a senha certa deve abrir `/admin` com "Logado como <email>", e o botão Sair deve voltar ao login.
4. Se aparecer erro 500: abra o projeto → Deployments → deploy atual → **Functions / Real-time logs** (ou Observability), reproduza o erro e copie a mensagem exata.

## RELATE

Liste, para cada passo: feito / não feito / bloqueado, mais: o Database ID, a URL final, e qualquer mensagem de erro copiada literalmente. Não tente corrigir erros de build ou de código; o desenvolvimento está em outra sessão.
