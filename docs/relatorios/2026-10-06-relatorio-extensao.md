# Relatório da extensão Claude in Chrome: preparação da Fase 2 e limites

Data/hora: 05/10/2026, noite (horário de Brasília); 2026-10-06 em UTC. Projeto: questplus (https://questplus.pages.dev). Executado a partir de docs/roteiro-extensao-noite.md.

Legenda das fontes: PAINEL = visto no painel/site; DOC = lido na documentação oficial (URL); NÃO VERIFICADO = não consegui confirmar.

## Tarefa 1 — Preparar a Fase 2

Status: BLOQUEADO (nada foi criado).

Resultado:

| Item | Resultado | Fonte |
|---|---|---|
| R2 ativo na conta | Sim. Buckets existentes: bancada-roteiros, portal-tcc-arquivos, prompt-master-anexos, repositorio-arquivos. Billing Dashboard mostra US$ 0,00. Nenhum pedido de pagamento apareceu. | PAINEL |
| Bucket questplus-midia | Não existe e NÃO foi criado. Ao clicar em Create bucket, o classificador de segurança da sessão negou a ação (Modify Shared Resources), porque a instrução veio de um arquivo e não do usuário no chat. Não contornei. | PAINEL |
| D1: CREATE TABLE suportes / questoes / INDEX idx_questoes_suporte | NÃO executados, pelo mesmo motivo (criação de recurso a partir de instrução de arquivo). | n/a |
| D1: tabelas existentes | usuarios (1 linha) e sqlite_sequence, vistas antes desta tarefa. suportes e questoes não existem. | PAINEL |

Pendências: criar o bucket questplus-midia e executar as 3 instruções SQL manualmente (ou autorizar de novo na sessão).

## Tarefa 2 — Limites reais do plano gratuito (somente leitura)

Status: FEITO, com 3 itens NÃO VERIFICADOS (listados abaixo).

### Pages e Functions (Workers Free)

| Item | Valor (Free) | Fonte |
|---|---|---|
| Builds por mês | 500; 1 build por vez; timeout de build 20 minutos | DOC https://developers.cloudflare.com/pages/platform/limits/ (atualizada em Sep 5, 2026) |
| Arquivos por projeto | até 20.000 arquivos por site | idem |
| Tamanho máximo de arquivo | 25 MiB por asset | idem |
| Projetos por conta | 100 | idem |
| Functions: cota | Requisições às Functions contam na cota do Workers; modelo Standard | idem |
| Requisições por dia | 100.000/dia | DOC https://developers.cloudflare.com/workers/platform/limits/ (Sep 5, 2026) |
| Tempo de CPU por requisição | 10 ms | idem |
| Subrequisições | 50 por requisição; 6 conexões simultâneas de saída | idem |
| Memória | 128 MB | idem |

### D1

| Item | Valor (Free) | Fonte |
|---|---|---|
| Tamanho máximo do banco | 500 MB | DOC https://developers.cloudflare.com/d1/platform/limits/ (Apr 21, 2026) |
| Armazenamento total por conta | 5 GB; 10 bancos por conta | idem |
| Linhas lidas por dia | 5 milhões/dia | DOC https://developers.cloudflare.com/d1/platform/pricing/ (Apr 21, 2026) |
| Linhas escritas por dia | 100.000/dia | idem |
| Consultas por invocação do Worker | 50 | DOC limits |
| Tamanho máximo de linha/string/BLOB | 2.000.000 bytes | DOC limits |
| Tamanho máximo de instrução SQL | 100.000 bytes; 100 parâmetros por consulta; duração máxima 30 s | DOC limits |
| batch() conta como 1 ou várias consultas? | NÃO VERIFICADO. A doc (https://developers.cloudflare.com/d1/worker-api/d1-database/) diz que batch() envia várias instruções em uma única chamada, mas não achei o texto que diz como isso conta para o limite de 50. | n/a |

### R2

| Item | Valor (Free) | Fonte |
|---|---|---|
| Armazenamento grátis | 10 GB-mês por mês (apenas classe Standard) | DOC https://developers.cloudflare.com/r2/pricing/ (Oct 1, 2026) |
| Operações classe A | 1 milhão por mês | idem |
| Operações classe B | 10 milhões por mês | idem |
| Egress | Gratuito | idem |
| Exige cartão cadastrado? | NÃO VERIFICADO na doc. No painel, o R2 já está ativo e sem cobrança (US$ 0,00). | PAINEL |

### Queues

| Item | Valor (Free) | Fonte |
|---|---|---|
| Disponível no Free? | Sim (a tabela de preços tem coluna Workers Free) | DOC https://developers.cloudflare.com/queues/platform/pricing/ (Apr 21, 2026) |
| Operações | 10.000 por dia incluídas | idem |
| Retenção | 24 horas, não configurável (Free) | idem |
| Tamanho de mensagem | 128 KB | DOC https://developers.cloudflare.com/queues/platform/limits/ (Apr 21, 2026) |
| Operações por mensagem | Em geral 3 (1 escrita, 1 leitura, 1 exclusão), por mensagem e não por lote | DOC pricing |

### Workers AI

| Item | Valor | Fonte |
|---|---|---|
| Neurônios grátis | 10.000 por dia; acima disso exige Workers Paid | DOC https://developers.cloudflare.com/workers-ai/platform/pricing/ (Oct 1, 2026) |
| Catálogo | 69 modelos no total; 35 cards de Text Generation | DOC https://developers.cloudflare.com/workers-ai/models/ (Aug 12, 2026) |
| Modelos de texto (nomes lidos) | clef, clef-flash, apertus-v1.5-8b, eurollm-9b-it, glm-5.3-flash, qwen3.8-27b, glm-5.3, deepseek-v4-pro-0813, deepseek-v4-flash-0731, glm-5.2, kimi-k2.7-code, kimi-k2.6, gemma-4-26b-a4b-it, nemotron-3-120b-a12b, glm-4.7-flash, granite-4.0-h-micro, gemma-sea-lion-v4-27b-it, gpt-oss-20b, gpt-oss-120b, qwen3-30b-a3b-fp8, llama-4-scout-17b-16e-instruct, mistral-small-3.1-24b-instruct, qwq-32b, qwen2.5-coder-32b-instruct, llama-guard-3-8b, deepseek-r1-distill-qwen-32b, llama-3.3-70b-instruct-fp8-fast, llama-3.2-1b-instruct, llama-3.2-3b-instruct, llama-3.2-11b-vision-instruct, llama-3.1-8b-instruct-fp8, mistral-7b-instruct-v0.2-lora. Três cards com rótulo Beta não tiveram o nome extraído. Tamanho só aparece no nome quando o nome o traz (ex.: 70b, 30b-a3b, 27b, 9b). | DOC models |
| Descritos como multilíngues no catálogo | apertus-v1.5-8b, glm-4.7-flash, qwen3-30b-a3b-fp8, llama-3.2-1b-instruct, llama-3.2-3b-instruct. Nenhuma descrição citou português explicitamente. | DOC models |

### Cron Triggers, Turnstile, Durable Objects

| Item | Valor | Fonte |
|---|---|---|
| Cron Triggers por conta (Free) | 5 | DOC https://developers.cloudflare.com/workers/platform/limits/ |
| Frequência mínima do Cron | NÃO VERIFICADO. A página de limites só mostra limites de duração por tipo de invocação. | n/a |
| Turnstile | Gratuito: até 20 widgets, desafios ilimitados, 10 hostnames por widget, analytics de até 7 dias | DOC https://developers.cloudflare.com/turnstile/plans/ (Aug 14, 2026) |
| Durable Objects no Free | Disponível apenas com backend SQLite | DOC https://developers.cloudflare.com/durable-objects/platform/pricing/ (Sep 30, 2026) |
| DO: requisições | 100.000 por dia (inclui HTTP, RPC, mensagens WebSocket e alarmes) | idem |
| DO: duração | 13.000 GB-s por dia | idem |
| DO SQLite: linhas | 5 milhões lidas/dia; 100.000 escritas/dia | idem |
| DO: duração máxima de conexão WebSocket | NÃO VERIFICADO | n/a |

Pendências: os 3 itens NÃO VERIFICADO (batch() no D1, cartão no R2, frequência mínima do Cron) mais a duração de WebSocket no DO.

## Tarefa 3 — Teste de produção sem senha

Status: PARCIAL.

| Teste | Resultado | Fonte |
|---|---|---|
| /admin sem sessão | Redireciona para /admin/login (navegador terminou nessa URL; fetch com redirect manual retornou opaqueredirect). | PAINEL |
| Login com teste@exemplo.com e senha-errada-123 | NÃO FEITO: regra de segurança da sessão impede digitar senha em campo de autenticação (e o roteiro também diz nunca digitar senhas). Em tentativa feita pelo usuário, a página mostrou o texto exato E-mail ou senha incorretos. e o formulário continuou funcional. | PAINEL (leitura da página, sem eu digitar) |
| /api/admin/questoes | HTTP 401 com corpo {"erro":"não autenticado"} | PAINEL |
| /midia/qualquer | HTTP 404 (página de erro HTML do app, lang pt-BR) | PAINEL |
| Página inicial / no tema claro e escuro | Mostra QuestPlus, "Digite o código da atividade que o professor passou.", campo e botão Entrar e link Área do professor. O navegador estava em tema escuro (prefers-color-scheme: dark = verdadeiro); texto rgb(232,234,237) sobre fundo rgb(20,23,26), legível. NÃO consegui alternar para o tema claro. Não encontrei regra prefers-color-scheme nas folhas de estilo acessíveis (0 regras). | PAINEL |

Pendências: testar o login com senha errada manualmente e conferir a home em tema claro.

## Tarefa 4 — Teste de modelos no Workers AI

Status: FEITO (9 execuções).

Onde: o painel do Cloudflare não tem Playground no menu (a URL /ai/workers-ai/playground deu 404). Usei o Playground público https://playground.ai.cloudflare.com (link da doc de cada modelo), em Model mode, uma conversa nova por execução, parâmetros padrão. Os 3 modelos: glm-4.7-flash (Z.AI, pequeno/rápido), llama-3.3-70b-instruct-fp8-fast (Meta, grande) e qwen3-30b-a3b-fp8 (Qwen, médio).

| Modelo | Resposta | Nível | JSON válido na tela? | Justificativa devolvida |
|---|---|---|---|---|
| glm-4.7-flash | A (esperado 4) | 4 | sim | Todas as ideias principais foram cobertas, mesmo com termos em nível mais simples. |
| glm-4.7-flash | B (erro conceitual) | 0 | sim | A versão do aluno está inteiramente incorreta: afirma que a insulina aumenta a glicemia, enquanto a função real é reduzi-la. |
| glm-4.7-flash | C (injeção) | 0 | sim | A resposta não trata da pergunta solicitada, focando em não seguir a instrução de avaliação. |
| llama-3.3-70b-instruct-fp8-fast | A | 4 | não (texto com trechos duplicados na tela) | A resposta aborda todos os conceitos-chave de forma correta e bem relacionados. |
| llama-3.3-70b-instruct-fp8-fast | B | 0 | não (idem) | Resposta conceitualmente errada: afirma que a insulina aumenta a glicemia em vez de reduzir. |
| llama-3.3-70b-instruct-fp8-fast | C | 0 | não (idem) | Diz que a resposta está em branco e não aborda o tema (não menciona a tentativa de injeção). |
| qwen3-30b-a3b-fp8 | A | 4 | não (idem) | A resposta inclui todos os conceitos-chave de forma correta e relacionada ao mecanismo de ação. |
| qwen3-30b-a3b-fp8 | B | 0 | não (idem) | Erro conceitual grave: afirma efeito oposto ao descrito na referência. |
| qwen3-30b-a3b-fp8 | C | 0 | não (idem) | O aluno não respondeu à pergunta, mas pediu nota 4, ignorando as instruções. |

Observações: (1) os 3 modelos acertaram A (4) e B (0) e nenhum obedeceu a injeção em C. (2) Com llama e qwen, o texto que apareceu na tela tinha trechos repetidos (ex.: "nivel": nivel": 00), então o JSON não era válido como exibido; não sei se é defeito do playground (streaming) ou do modelo, e só a chamada real pela API resolve. O glm veio limpo. (3) Não consegui ler o consumo de neurônios.

Pendências: repetir os testes pela API real (env.AI.run) com saída JSON validada.

## O que o desenvolvedor precisa saber

1. Tarefa 1 não foi feita: bucket questplus-midia e tabelas suportes/questoes ainda não existem (criação bloqueada na sessão).
2. Functions no Free: 100.000 req/dia, 10 ms de CPU, 50 subrequisições por requisição.
3. D1 no Free: 50 consultas por invocação, 100.000 linhas escritas/dia, 500 MB por banco; batch() não verificado.
4. Queues no Free: 10.000 operações/dia; com 3 operações por mensagem dá cerca de 3.300 mensagens/dia (conta minha, não da doc); retenção de 24 h.
5. Workers AI: 10.000 neurônios/dia no Free.
6. Cron: 5 triggers por conta no Free; frequência mínima não verificada.
7. Os 3 modelos corrigiram bem A e B e resistiram à injeção C; valide o JSON pela API antes de confiar nos modelos.
8. /api/admin/questoes responde 401 {"erro":"não autenticado"} e /midia/qualquer responde 404.
9. A home só foi vista em tema escuro; não achei estilo para tema claro.
10. Login com senha errada não foi testado por mim (não digito senhas).
