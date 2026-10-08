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

- **Importar e exportar questões (JSON)**: `/admin/questoes/importar` (colar o texto ou enviar o arquivo; confere antes de gravar, mostra o gabarito de cada questão, importa em blocos de 40, pula duplicadas) e exportação do banco ou do filtro atual. A tela gera a **instrução pronta para uma IA** produzir o JSON (tema, quantidade, nível, formatos, etiquetas) com botão de copiar. Tolera erros comuns de IA (cerca de código markdown, "A)" no começo das alternativas, gabarito em letra, V/F em texto). Formato: `{ "formato": "questplus-questoes", "versao": 2, "questoes": [...] }`: **as questões não levam mais texto de apoio** (o apoio é da atividade). Arquivos antigos com `suportes` ainda são lidos, e o apoio é ignorado.
- **Importar e exportar textos de apoio (JSON)**: `/admin/suportes/importar` e exportação em `/api/admin/suportes/exportar`, formato `{ "formato": "questplus-suportes", "versao": 1, "suportes": [{ "titulo", "texto", "etiquetas" }] }`, em blocos de 4 textos, pulando duplicados (mesmo título e texto). Tem **instrução pronta para IA** com botão de copiar (inclui as regras dos diagramas Mermaid). Imagens não vão no JSON: o texto sai com `observacao` começando por `[img]`.
- **Banco de questões (busca e seleção)**: a lista de questões e o seletor da atividade usam os mesmos filtros, que **se combinam** (E): busca, **disciplina**, formato, situação (só na lista) e **várias etiquetas** ao mesmo tempo, com ordenação e contagem de questões em cada opção (as opções mostram o que ainda combina com o que já foi escolhido). Os filtros ligados aparecem como chips que se desligam um a um e a URL guarda tudo. Cada questão aparece com formato, pontos, disciplina, etiquetas, apoio, uso em atividades e "Ver questão e gabarito". A **disciplina é a primeira etiqueta** da questão e vem da lista do curso técnico em Análises Clínicas (`src/lib/disciplinas.ts`; edite para incluir ou renomear). Cadastro, importação e a instrução para IA exigem a disciplina como primeira etiqueta (a importação só avisa quando falta). Duas funções novas: **ações em lote** na lista (marcar uma página ou "todas as N do filtro" e ativar, inativar, definir disciplina, adicionar ou remover etiqueta, excluir; as que estão em atividades não são excluídas) e **sorteio** no seletor da atividade (sortear N do filtro, com a opção de distribuir igualmente entre as disciplinas). As questões antigas, sem disciplina, podem receber uma de uma vez com "Definir disciplina…" em lote.
- **Atividades:** botões **Clonar** (cópia inativa, sem datas, com código novo) e **Excluir** (com tentativas exige confirmação reforçada, porque apaga as respostas dos alunos).

- **Textos de apoio com até 10 imagens**: As imagens saem sempre **centralizadas** (com a legenda centralizada abaixo). cada imagem tem um código fixo (`[img1]`…`[img10]`); escrever o código no texto posiciona a imagem ali, e as não citadas aparecem no final. Por imagem: legenda, tamanho (pequena 240 px, média 420 px, grande 640 px ou largura personalizada de 50 a 1600 px) e remover. Entram por arquivo ou por **link**: o servidor baixa e guarda no R2 (recusa SVG, páginas, mais de 2 MB, endereços internos e IPs; segue no máximo 3 redirecionamentos conferindo cada um; 10 s de limite). Quando não consegue, diz o motivo e o envio por arquivo continua. O texto de apoio pode ser **excluído** mesmo em uso (as atividades ficam sem apoio), com confirmação reforçada. O arquivo do R2 só é apagado se nenhum outro apoio nem prova já feita o usa. Exige `migrations/0005_suportes_imagens.sql` no banco antes de publicar.

- **Relatórios por atividade** (`/admin/atividades/[id]/relatorio`): resumo (alunos, média, mediana, maior e menor, distribuição por faixa), aproveitamento por questão e tabela de alunos com a **maior nota** de cada um (e os pontos por questão). Filtro por turma, **Imprimir** (folha A4 clara, mesmo com o tema escuro ligado) e exportar em **JSON** (tentativas completas, com a cópia das questões como o aluno viu, o gabarito e as respostas) e **CSV** (UTF-8 com BOM, separador `;`, vírgula decimal; textos que começam com `=`, `+`, `-` ou `@` são neutralizados contra fórmulas de planilha). Só o professor acessa.
- **Relatório individual** (`/admin/tentativas/[id]/relatorio`): é o "retorno detalhado" da Prova: cada questão com a resposta do aluno, o gabarito e a explicação, com a opção de imprimir com ou sem gabarito e com ou sem textos de apoio. **Todos os alunos** em um documento (`/admin/atividades/[id]/relatorios`, uma folha por aluno): o navegador busca um aluno de cada vez, para o servidor não montar um documento enorme (limite de CPU do plano gratuito).
- **Usabilidade:** painel inicial com números e passo a passo; ver o gabarito e **duplicar** questão na lista; aviso antes de sair de um formulário com alterações não salvas; na Prova, aviso ao fechar a aba e aviso de tempo ("faltam 5 minutos", "falta 1 minuto"); sessão expirada volta ao login com explicação; página de erro em português.

- **Proteção contra abuso do início de tentativas** (`POST /api/tentativas`, o único endpoint público que grava): dois limites por endereço de rede em janela de 24 h, **sem guardar o IP** (só um hash com o segredo do sistema). (1) **Palpites errados** (código inexistente ou turma que não pode responder): 50 por IP; passado o limite, aquele IP não inicia mais nada até a janela vencer (429). (2) **Inícios por atividade**: 200 por IP e por atividade; é por atividade e alto de propósito, porque uma turma inteira costuma sair do mesmo IP da escola. Pedidos bloqueados não gravam nada (não gastam a cota de escritas do D1), e dados inválidos ou a regra de tentativas do aluno (409) não contam. Os valores ficam em `vars` do `wrangler.jsonc` (`LIMITE_PALPITES_IP_DIA`, `LIMITE_INICIOS_IP_ATIVIDADE_DIA`). Exige `migrations/0006_limites.sql`. Risco conhecido: quem usa a mesma rede de um brincalhão que errar 50 códigos fica sem poder iniciar por até 24 h; nesse caso é só aumentar o valor ou limpar a tabela `limites`.
- **Fase 7 (questões abertas com IA)**: novo formato **Aberta** no cadastro (resposta de referência, 1 a 6 conceitos com sinônimos, pares de oposição, mínimo de caracteres e tabela de pontos por nível 0 a 4), também no JSON de importação e no prompt para IA. O aluno escreve até 1200 caracteres, vê o mínimo da questão e um **alerta visual** ("resposta muito curta, pode não ser pontuada", com quantos caracteres faltam) enquanto estiver abaixo dele (na Prova salva sozinho; no Treino envia uma vez e a questão trava); **nunca recebe referência, conceitos nem rubrica**, e a questão aberta não tem gabarito nem nota na hora (a nota do aluno fica "parcial" com aviso). O professor corrige em `/admin/atividades/[id]/abertas`: **triagem por regra sem IA** (em branco, curta, só símbolos, repetição, cópia do enunciado → nota 0, ajustável), conferência de conceitos e de pares de oposição por regra, depois a IA sugere o nível 0 a 4 com justificativa e a **% de aproximação** (embeddings) aparece ao lado como sinal de apoio, com alertas de divergência e de possível cópia entre alunos. **A nota só vale depois que o professor confirma** (individual, ajustando o nível, ou em lote só nas sugestões sem alerta). A IA corrige uma resposta por chamada, disparadas pelo navegador do professor (sem fila), para caber no limite de CPU do plano gratuito. Sem IA configurada, a correção manual por nível continua funcionando. Exige `migrations/0007_correcoes_abertas.sql` no banco **antes** de publicar (o relatório individual lê a tabela nova) e o binding `ai` (já em `wrangler.jsonc`). Modelos configuráveis por variável (`IA_MODELO_LLM`, padrão `@cf/meta/llama-3.3-70b-instruct-fp8-fast`; `IA_MODELO_EMBEDDING`, padrão `@cf/baai/bge-m3`): **os ids e a qualidade ainda não foram verificados em produção**; roteiro em `docs/roteiro-extensao-fase7.md`. No relatório do aluno o nível aparece como indicador qualitativo (4 Excelente, 3 Bom, 2 Regular, 1 Insuficiente, 0 Não atende); o número fica só na tela de correção. Detalhes de desenho em `docs/questoes-abertas-ia.md`.
- **Proteção do login do professor** (`/admin/login`): a área `/admin` e `/api/admin` já exige sessão (cookie assinado de 12 h; sem sessão a API devolve 401 e as páginas redirecionam ao login). Agora o login também tem freio contra tentativa de senha em massa, com janela de 1 h e sem guardar IP nem e-mail (só hashes): **10 senhas erradas por IP** (`LIMITE_LOGIN_FALHAS_IP_HORA`) e **50 por e-mail**, de qualquer IP (`LIMITE_LOGIN_FALHAS_EMAIL_HORA`). Passado o limite a resposta é 429 imediata, sem gastar CPU com a verificação, até com a senha certa. Entrar com sucesso zera os contadores daquele IP e daquele e-mail. Risco conhecido: quem tentar muitas vezes o e-mail do professor pode travá-lo por até 1 h; nesse caso, limpe a tabela `limites` (`DELETE FROM limites WHERE chave LIKE 'login:%'`). Não precisa de migração nova (usa a tabela `limites`).
- **Cabeçalhos de segurança** em todas as respostas (`hooks.server.ts`): sem embutir o site em outro (`X-Frame-Options: DENY`, `frame-ancestors 'none'`), `nosniff`, política de referrer e permissões; o painel e as APIs de tentativa saem com `Cache-Control: no-store`. O limite do painel é exato: `/admin` e `/admin/...` são protegidos, mas um código de atividade como `/administrador` continua sendo link curto do aluno.
- **Imagem na questão**: cada questão pode ter uma imagem (no cadastro, logo abaixo do enunciado), com legenda e tamanho (pequena, média, grande ou largura própria), enviada por arquivo ou por link como nos textos de apoio. Aparece **sempre centralizada, abaixo do enunciado**, na tela do aluno, nos relatórios, na prévia das listas e na correção das abertas. Fica dentro do `config` da questão (sem migração) e, por isso, a cópia que a tentativa guarda leva a imagem junto, inclusive com alternativas embaralhadas. O arquivo no R2 só é apagado quando nenhum apoio, nenhuma prova já feita e nenhuma outra questão o usa (vale ao trocar, excluir e excluir em lote). **Exportar JSON** não leva a imagem (o arquivo dela fica no R2 deste sistema): a questão sai sem ela e com o campo `observacao` começando por `[img]`; ao importar, o preview avisa que a questão tinha imagem para anexar de novo. Imagem dentro das alternativas ainda não existe.
- **Turmas**: dá para excluir, só pelo caminho seguro. Turma com tentativas de alunos nunca é excluída (o modal explica e oferece **Inativar**, que a tira da lista do aluno e preserva o histórico). Turma em atividades só é excluída com confirmação e é retirada delas; se for a única turma de alguma atividade, a exclusão é recusada (a atividade ficaria sem ninguém para responder). Sem uso, exclui direto. A lista de atividades ganhou o filtro por **turma ativa**, que combina com as abas de situação, e uma coluna com as turmas de cada atividade.
- **Instrução para IA**: o botão "Copiar instrução para IA" da lista de questões usa as últimas opções salvas na tela Importar (disciplina, formatos, etiquetas), então não difere do que aparece lá; o padrão já inclui a questão aberta.
- **Excluir questão**: se a questão está em alguma atividade, o modal já avisa (e bloqueia o botão) antes de confirmar; o servidor continua recusando com a lista das atividades. Na V ou F, a questão só conta como respondida com todas as afirmações marcadas (parcial aparece como ◐); no Treino, resposta parcial é recusada para não travar a questão.
- **Texto de apoio pertence à atividade** (migração `0008`): cada atividade tem **no máximo um** apoio, escolhido ao criar/editar a atividade (seletor com busca e filtros). O aluno o vê **aberto antes da questão 1** e, nas demais, num "Reler o texto de apoio" recolhido; a tentativa guarda uma cópia (`tentativas.suporte`), então editar o texto depois não muda provas feitas. Relatórios imprimem o apoio uma vez. As colunas antigas `questoes.suporte_id` e `atividades` anteriores foram descartadas (dados apagados). Os textos usam **disciplina (primeira etiqueta), etiquetas, filtros combináveis, contagens e ações em lote** como as questões (`/admin/suportes`). Excluir um apoio em uso exige confirmação reforçada (`?desvincular=1`: as atividades ficam sem apoio).
- **Diagramas Mermaid no texto de apoio**: bloco ```` ```mermaid ```` com `flowchart`, `sequenceDiagram`, `stateDiagram-v2` ou `pie`, desenhado no navegador (carregado só quando há diagrama, nível de segurança estrito, sem HTML nos rótulos). Limite: 3 diagramas por texto, 3000 caracteres cada. Se o diagrama tiver erro, aparece o código-fonte com um aviso. Na impressão sai em fundo claro.
- **Aviso de nomes iguais com e-mails diferentes** no relatório da atividade (o aluno é identificado pelo e-mail).

As demais fases seguem a tabela da documentação.

> Atenção ao escrever mensagens de commit: o Cloudflare Pages pula o build se a mensagem contiver a expressão de pular CI entre colchetes, **mesmo citada em uma frase** (isso já aconteceu aqui). Só use essa expressão quando quiser mesmo pular o deploy.

**Tema visual:** Neumorphism em cartões, paleta azul oceano, **só modo claro** (o botão de tema escuro foi retirado). Os tokens (cores, raio de 20 px, sombras de relevo, tipografia Century Gothic/Avenir/Segoe UI, tempos de transição) ficam em `src/routes/+layout.svelte`; todo o sistema usa só essas variáveis (`--primaria`, `--secundaria`, `--destaque`, `--texto-secundario`, `--sucesso`, `--erro`…). Contraste conferido em AA (texto ≥ 4,5:1, contorno de controles ≥ 3:1), foco sempre visível, `prefers-reduced-motion` respeitado e relevo desligado na impressão. O painel do professor (`/admin`) é um dashboard de cartões: três indicadores, gráfico de tentativas finalizadas por dia (14 dias, com tabela equivalente), lista lateral de atividade recente e tabela das atividades abertas; no celular tudo empilha em uma coluna (pontos de quebra de 960 px e 640 px).

## Desenvolvimento local

```bash
npm install
cp .dev.vars.example .dev.vars          # defina JWT_SECRET
npm run build
npx wrangler d1 migrations apply questplus --local
npx wrangler d1 execute questplus --local --command "$(node scripts/gerar-admin.mjs EMAIL SENHA)"
npm run preview:local                                   # http://localhost:8788 (porta opcional: node scripts/preview-local.mjs 8790)
```

`npm run preview:local` roda o `wrangler pages dev` **sem o binding `ai`** do `wrangler.jsonc` (ele exige conta Cloudflare e rede) e restaura o arquivo ao sair. Para testar a correção das questões abertas localmente, ponha `IA_FAKE=1` em `.dev.vars`: um modelo simulado e determinístico substitui o Workers AI. Isso testa o fluxo, **não a qualidade da IA real**.

Outros comandos: `npm test` (vitest), `npm run check` (svelte-check).

### Notas de stack (SvelteKit 3 + adapter-cloudflare 8)

- A configuração do SvelteKit fica em `vite.config.ts`; `svelte.config.js` não é mais aceito.
- `$lib` foi removido: use `#lib/...` (mapeado em `package.json` → `imports`).
- Imports de componentes usam `#lib/components/...`; o resto de `#lib/...` aponta para arquivos `.ts`.
- Não existe mais `event.platform`. Bindings e segredos vêm de `import { env } from 'cloudflare:workers'`, encapsulado em `src/lib/server/env.ts`.

## Tela do aluno: "caderno de prova"

Durante a atividade a tela segue o tema **caderno de prova**: no computador, um painel lateral fixo (título, componente curricular, tempo restante, grade de questões com ✔ nas respondidas e contagem) e, ao lado, a "folha" da questão com o número grande, alternativas em linhas pontilhadas com marca de bolha e as ações (Anterior/Próxima/Responder) que acompanham a rolagem. No **celular** o painel vira uma faixa fixa no topo (título, relógio e botões das questões) e Anterior/Próxima ficam fixos na base, com áreas de toque grandes. Os números das questões usam o estilo dos botões do sistema, sem brilho: contorno claro (não respondida), botão claro com ✔ verde (respondida) e laranja de destaque (atual). O texto de apoio abre antes da questão 1 e fica em "Reler" nas demais. **Imagens** de questão e de texto de apoio abrem ampliadas ao clicar ou tocar (Enter/Espaço no teclado), com zoom por roda do mouse, botões + e −, pinça no celular, duplo clique e arrastar para mover; fecham no X, clicando fora ou com Esc (componente `Lightbox.svelte`, montado no layout raiz). Em atividades de navegação sequencial a grade não aparece (só "Questão X de N" e a barra de progresso). Código em `src/lib/components/Tentativa.svelte`.

## Professor(a), página Relatórios e relatório resumido (0011)

- **Nome do professor(a)** em `/admin/perfil` (link "Perfil" no cabeçalho): um nome só para o sistema, de 2 a 100 caracteres, que sai em "Professor(a): …" abaixo do componente curricular em **todos** os relatórios (da atividade, individuais, todos os alunos, resumido) e no JSON exportado. Vazio: a linha some. Fica na tabela `configuracoes` (`migrations/0011_configuracoes.sql`); sem a tabela os relatórios continuam abrindo, só sem o nome.
- **Página Relatórios** (`/admin/relatorios`, item novo do menu e atalho "Ver relatórios" no painel): lista as atividades com turmas, alunos que finalizaram, média, peso e aviso de abertas a corrigir; **busca pelo título** (sem acento nem caixa, com destaque) e **filtro de turma** respondem enquanto se digita, mais situação (todas, com tentativas, com abertas a corrigir) e ordem. Busca, turma, situação e ordem ficam na URL. Botões: Relatório, Individuais, Corrigir abertas.
- **Relatório resumido para imprimir** (`/admin/atividades/[id]/resumo`, `?turma=ID` filtra): cabeçalho da atividade (professor(a), turmas, modo, código, prazo, questões, pontuação total, peso) e lista **só de quem finalizou** em ordem alfabética: estudante, e-mail, data e hora e **nota final** (com peso: ponderada; sem peso: pontos). A letra reduz sozinha para caber em uma folha A4 (testado com 45 alunos). O botão **Imprimir** do relatório da atividade agora abre um modal para escolher **Resumido, 1 página** ou **Completo** (como antes).

## Peso da atividade nos relatórios (0010)

No **relatório da atividade** há o campo **Peso da atividade** (0 a 10, uma casa decimal; aceita vírgula), com "Salvar peso". **Vazio = tudo como antes.** Com peso, a nota é *pontos obtidos ÷ pontos possíveis × peso*, com uma casa decimal: 40 de 80 pontos com peso 3,0 dá nota **1,5**. O **relatório individual** passa a mostrar "Score: 40 de 80 pontos", "Pontuação da atividade: 3,0" e "Nota: 1,5" com a nota em destaque (na impressão sai em preto no branco); o relatório da atividade ganha a coluna "Nota (peso X)" (maior nota de cada aluno) e o cabeçalho mostra o peso; o JSON exportado leva `atividade.peso` e `nota_ponderada` por aluno. O CSV não muda. O peso é da atividade (vale para todos os alunos e relatórios) e pode ser trocado ou removido a qualquer momento. Exige `migrations/0010_peso_da_atividade.sql` no banco **antes** de publicar (`ALTER TABLE atividades ADD COLUMN peso REAL;`). API: `PUT /api/admin/atividades/[id]/peso` com `{ "peso": 3 }` (`null` remove).

## Componente curricular da atividade (0009)

Cada atividade pode ter um **componente curricular** (opcional), escolhido logo abaixo do título no formulário. Ele é cadastrado ali mesmo (**Novo**) e fica numa lista suspensa; **Gerenciar** abre um modal com os componentes cadastrados, onde se pode **editar** o nome ou **excluir** (se há atividades usando, o modal avisa quantas e elas ficam sem componente). O aluno vê o componente **abaixo do título da atividade** (na entrada e durante a prova); nos relatórios (da atividade, individual e no JSON de resultados) ele também aparece, e a lista de atividades mostra sob o título. Sem componente escolhido, nada muda. Não afeta questões nem textos de apoio. API: `/api/admin/componentes` (GET, POST) e `/api/admin/componentes/[id]` (PUT, DELETE; em uso exige `?desvincular=1`, senão 409). O relatório mostra o nome atual (renomear ou excluir muda também os relatórios antigos). Exige `migrations/0009_componentes_curriculares.sql` no banco **antes** de publicar (roteiro em `docs/roteiro-extensao-componentes.md`).

## Publicar o apoio na atividade (0008)

Antes do deploy, no D1 `questplus` (Console, **uma instrução por vez**, conferindo com `PRAGMA table_info(<tabela>)`): as 3 de `migrations/0008_apoio_na_atividade.sql`. Roteiro em `docs/roteiro-extensao-apoio-na-atividade.md`. Só depois publique o código.

## Ordem para publicar as Fases 4 a 6 (a 0007 da Fase 7 já foi aplicada em produção em 06/10/2026)

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
