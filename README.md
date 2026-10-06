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

- **Importar e exportar questões (JSON)**: `/admin/questoes/importar` (colar o texto ou enviar o arquivo; confere antes de gravar, mostra o gabarito de cada questão, importa em blocos de 40, pula duplicadas) e exportação do banco ou do filtro atual. A tela gera a **instrução pronta para uma IA** produzir o JSON no formato certo (tema, quantidade, nível, formatos, etiquetas) com botão de copiar. A importação tolera erros comuns de IA (cerca de código markdown, "A)" no começo das alternativas, gabarito em letra, V/F em texto). Formato: `{ "formato": "questplus-questoes", "versao": 1, "suportes": [...], "questoes": [...] }`.
- **Filtros em tempo real** na lista de questões e no seletor de questões da atividade (busca no servidor, paginada de 20 em 20, com "adicionar todas as N do filtro", limite de 100 por atividade): feito para bancos de centenas de questões.
- **Atividades:** botões **Clonar** (cópia inativa, sem datas, com código novo) e **Excluir** (com tentativas exige confirmação reforçada, porque apaga as respostas dos alunos).

- **Textos de apoio com até 10 imagens**: cada imagem tem um código fixo (`[img1]`…`[img10]`); escrever o código no texto posiciona a imagem ali, e as não citadas aparecem no final. Por imagem: legenda, tamanho (pequena 240 px, média 420 px, grande 640 px ou largura personalizada de 50 a 1600 px) e remover. Entram por arquivo ou por **link**: o servidor baixa e guarda no R2 (recusa SVG, páginas, mais de 2 MB, endereços internos e IPs; segue no máximo 3 redirecionamentos conferindo cada um; 10 s de limite). Quando não consegue, diz o motivo e o envio por arquivo continua. O texto de apoio pode ser **excluído** mesmo em uso (as questões ficam sem apoio), com confirmação reforçada. O arquivo do R2 só é apagado se nenhum outro apoio nem prova já feita o usa. Exige `migrations/0005_suportes_imagens.sql` no banco antes de publicar.

- **Relatórios por atividade** (`/admin/atividades/[id]/relatorio`): resumo (alunos, média, mediana, maior e menor, distribuição por faixa), aproveitamento por questão e tabela de alunos com a **maior nota** de cada um (e os pontos por questão). Filtro por turma, **Imprimir** (folha A4 clara, mesmo com o tema escuro ligado) e exportar em **JSON** (tentativas completas, com a cópia das questões como o aluno viu, o gabarito e as respostas) e **CSV** (UTF-8 com BOM, separador `;`, vírgula decimal; textos que começam com `=`, `+`, `-` ou `@` são neutralizados contra fórmulas de planilha). Só o professor acessa.
- **Relatório individual** (`/admin/tentativas/[id]/relatorio`): é o "retorno detalhado" da Prova: cada questão com a resposta do aluno, o gabarito e a explicação, com a opção de imprimir com ou sem gabarito e com ou sem textos de apoio. **Todos os alunos** em um documento (`/admin/atividades/[id]/relatorios`, uma folha por aluno): o navegador busca um aluno de cada vez, para o servidor não montar um documento enorme (limite de CPU do plano gratuito).
- **Usabilidade:** painel inicial com números e passo a passo; ver o gabarito e **duplicar** questão na lista; aviso antes de sair de um formulário com alterações não salvas; na Prova, aviso ao fechar a aba e aviso de tempo ("faltam 5 minutos", "falta 1 minuto"); sessão expirada volta ao login com explicação; página de erro em português.

- **Proteção contra abuso do início de tentativas** (`POST /api/tentativas`, o único endpoint público que grava): dois limites por endereço de rede em janela de 24 h, **sem guardar o IP** (só um hash com o segredo do sistema). (1) **Palpites errados** (código inexistente ou turma que não pode responder): 50 por IP; passado o limite, aquele IP não inicia mais nada até a janela vencer (429). (2) **Inícios por atividade**: 200 por IP e por atividade; é por atividade e alto de propósito, porque uma turma inteira costuma sair do mesmo IP da escola. Pedidos bloqueados não gravam nada (não gastam a cota de escritas do D1), e dados inválidos ou a regra de tentativas do aluno (409) não contam. Os valores ficam em `vars` do `wrangler.jsonc` (`LIMITE_PALPITES_IP_DIA`, `LIMITE_INICIOS_IP_ATIVIDADE_DIA`). Exige `migrations/0006_limites.sql`. Risco conhecido: quem usa a mesma rede de um brincalhão que errar 50 códigos fica sem poder iniciar por até 24 h; nesse caso é só aumentar o valor ou limpar a tabela `limites`.
- **Proteção do login do professor** (`/admin/login`): a área `/admin` e `/api/admin` já exige sessão (cookie assinado de 12 h; sem sessão a API devolve 401 e as páginas redirecionam ao login). Agora o login também tem freio contra tentativa de senha em massa, com janela de 1 h e sem guardar IP nem e-mail (só hashes): **10 senhas erradas por IP** (`LIMITE_LOGIN_FALHAS_IP_HORA`) e **50 por e-mail**, de qualquer IP (`LIMITE_LOGIN_FALHAS_EMAIL_HORA`). Passado o limite a resposta é 429 imediata, sem gastar CPU com a verificação, até com a senha certa. Entrar com sucesso zera os contadores daquele IP e daquele e-mail. Risco conhecido: quem tentar muitas vezes o e-mail do professor pode travá-lo por até 1 h; nesse caso, limpe a tabela `limites` (`DELETE FROM limites WHERE chave LIKE 'login:%'`). Não precisa de migração nova (usa a tabela `limites`).
- **Cabeçalhos de segurança** em todas as respostas (`hooks.server.ts`): sem embutir o site em outro (`X-Frame-Options: DENY`, `frame-ancestors 'none'`), `nosniff`, política de referrer e permissões; o painel e as APIs de tentativa saem com `Cache-Control: no-store`. O limite do painel é exato: `/admin` e `/admin/...` são protegidos, mas um código de atividade como `/administrador` continua sendo link curto do aluno.
- **Excluir questão**: se a questão está em alguma atividade, o modal já avisa (e bloqueia o botão) antes de confirmar; o servidor continua recusando com a lista das atividades. Na V ou F, a questão só conta como respondida com todas as afirmações marcadas (parcial aparece como ◐); no Treino, resposta parcial é recusada para não travar a questão.
- **Excluir texto de apoio direto da lista** (`/admin/suportes`), com modal de confirmação; se há questões usando, exige marcar o aviso e as questões ficam sem apoio.
- **Aviso de nomes iguais com e-mails diferentes** no relatório da atividade (o aluno é identificado pelo e-mail).

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

## Ordem para publicar as Fases 4 a 6

> **Estado:** as migrações 0004, 0005 e 0006 já foram aplicadas no D1 de produção e conferidas. O commit que publica as Fases 4 a 6 foi enviado depois delas.

O código novo grava e lê colunas que ainda não existem no banco de produção, então **o SQL vem antes do deploy**:

1. No D1 `questplus` (Console, uma instrução por vez): as 2 de `migrations/0004_modo_prova.sql`, as 2 de `migrations/0005_suportes_imagens.sql` e a de `migrations/0006_limites.sql` (texto pronto em `docs/roteiro-extensao-fase2-3.md` e na Parte A de `docs/prompt-extensao-teste-completo.md`).
2. Publicar (commit **sem** a expressão de pular CI na mensagem) e esperar o deploy ficar verde.
3. Rodar o teste completo com a extensão (`docs/prompt-extensao-teste-completo.md`).

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
| `src/lib/imagens.ts`, `src/lib/suporte.ts` | Imagens do texto de apoio (validação, tamanhos, proteção contra SSRF) e a renderização com `[imgN]` |
| `src/lib/importacao.ts`, `src/lib/server/importacao.ts` | Leitura tolerante do JSON, exportação, instrução para IA e importação em blocos |
| `src/lib/midia.ts` | Detecção de imagem pelos bytes (SVG é recusado de propósito) |
| `src/lib/server/questoes.ts`, `src/lib/server/atividades.ts` | Consultas ao D1 (vínculos em lote com `json_each`, por causa do limite de 50 consultas e 100 parâmetros) |
| `src/lib/correcao.ts`, `src/lib/atividade.ts` | Correção de MC e VF, estado e prazo da atividade, cópia da questão para a tentativa, validações |
| `src/routes/a/[codigo]`, `src/routes/[codigo]` | Tela do aluno e link curto |
| `src/routes/api/tentativas` | API pública do aluno: iniciar, ler, responder, finalizar (protegida pelo token da tentativa) |
| `src/routes/api/admin/{turmas,atividades}` | API do painel; `PUT /atividades/[id]/situacao` é o interruptor manual |
| `migrations/` | Migrações do D1 |
| `scripts/gerar-admin.mjs` | Gera o SQL do primeiro professor |
