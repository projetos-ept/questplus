# Teste completo do QuestPlus pela extensão Claude in Chrome

**A extensão só aceita criar dados a partir de instruções coladas no chat.** Cole a PARTE A, espere a confirmação, peça ao Claude Code para publicar, espere o deploy ficar verde e só então cole a PARTE B.

O teste cria apenas dados marcados com `[TESTE]` e grava o relatório em `docs/relatorios/2026-10-06-teste-completo.md`, na branch `relatorios-extensao`.

## PARTE A: SQL (colar primeiro)

```
Cloudflare, conta logada. Não digite senhas. D1 → banco questplus → Console. Rode UMA instrução por vez, na ordem, e confirme cada sucesso. Se alguma disser "duplicate column name", não force: me avise.

1) ALTER TABLE atividades ADD COLUMN mostra_nota INTEGER NOT NULL DEFAULT 0;
2) ALTER TABLE tentativas ADD COLUMN anulada INTEGER NOT NULL DEFAULT 0;
3) ALTER TABLE suportes ADD COLUMN imagens TEXT NOT NULL DEFAULT '[]';
4) UPDATE suportes SET imagens = json_array(json_object('n', 1, 'chave', imagem_chave, 'legenda', '', 'tamanho', 'media', 'largura', NULL, 'origem', NULL)) WHERE imagem_chave IS NOT NULL;

Depois, em Explore Data, confirme: atividades tem a coluna mostra_nota; tentativas tem anulada; suportes tem imagens (nas linhas que já tinham imagem, imagens começa com [{"n":1). Liste o que encontrou.
```

## PARTE B: teste completo (colar depois que o deploy estiver verde)

Ver o texto completo na resposta do Claude Code que acompanha este commit; ele é idêntico ao bloco abaixo.

```
Você é a extensão Claude in Chrome, logada no painel do QuestPlus (https://questplus.pages.dev/admin) e no GitHub do usuário. Faça um TESTE COMPLETO do sistema, em produção, e gere um relatório. Siga a ordem.

REGRAS
- Não digite senhas nem secrets. Se pedir login, pare e avise.
- Crie só dados cujo nome comece com "[TESTE]" e códigos que comecem com "teste-". Não apague nem altere nada que já existia antes do teste.
- Cada item: OK, FALHA ou NÃO VERIFICADO. Em FALHA copie a mensagem exata e descreva o que viu. Nunca escreva OK sem ter visto o resultado.
- Se algo travar por mais de ~5 minutos, registre e siga.
- Links de aluno: abra em ABA NOVA (aluno não precisa de login).
- Deixe aberta, em outra aba, a tela do Cloudflare: Workers & Pages → questplus → Functions → Real-time logs (ou Observability) e anote qualquer erro nos testes de importação, relatório e exportação, principalmente "Exceeded CPU", "1102" ou status 500.

ETAPA 0 - DEPLOY E TEMA
0.1 Deployments: o último deploy de Production está verde? Anote o commit.
0.2 /admin tem o menu: Painel, Questões, Textos de apoio, Turmas, Atividades, botão de tema e Sair?
0.3 A página abre em tema CLARO mesmo com o sistema em tema escuro? O botão alterna para escuro e a escolha continua após recarregar?

ETAPA 1 - TURMAS
1.1 Em Turmas crie "[TESTE] Turma A" (curso "Teste"). 1.2 Crie "[TESTE] Turma B", inative e reative.

ETAPA 2 - TEXTOS DE APOIO E IMAGENS
2.1 Textos de apoio → Novo. Título "[TESTE] Caso clínico". Texto, com uma linha em branco entre as partes:
  Paciente com dor torácica.
  [img1]
  Observe a imagem acima.
2.2 IMAGEM POR LINK (teste real do Cloudflare baixando de site externo). Em "cole o endereço da imagem" use https://upload.wikimedia.org/wikipedia/commons/4/47/PNG_transparency_demonstration_1.png e "Baixar e anexar". Esperado: cartão [img1] com miniatura e a fonte. Se der erro, copie a mensagem EXATA e tente outra URL pública de .png/.jpg de outro site; relate as duas.
2.3 Legenda "Teste de legenda". Troque o tamanho Pequena → Média → Grande → Personalizada (300) e confirme que a prévia muda.
2.4 A prévia mostra a imagem entre "Paciente..." e "Observe...". Apague o [img1] do texto: aparece aviso de imagem não citada e ela vai para o final da prévia. Use "Inserir no texto" com o cursor numa posição: o [img1] entra ali.
2.5 Link de página: https://commons.wikimedia.org/wiki/Main_Page → mensagem sobre página (não imagem). Texto "abc" → erro. http://localhost/x.png → recusado (endereço interno).
2.6 Enviar arquivo do computador: se não conseguir escolher arquivo, marque NÃO VERIFICADO (o usuário testa).
2.7 Salve; reabra: legenda e tamanho preservados. A lista mostra miniatura e "1 imagem(ns)".
2.8 Com o formulário alterado (digite algo no título), clique no menu "Turmas": deve aparecer confirmação de "alterações não salvas". Cancele e saia salvando.

ETAPA 3 - QUESTÕES: IMPORTAR, FILTRAR, VER, DUPLICAR, EXCLUIR
3.1 Questões → "Copiar instrução para IA": o botão muda para "Instrução copiada ✔". Em "Importar", mude Tema, Quantidade e marque MC5: o texto da instrução muda na hora.
3.2 Em Importar, cole o JSON abaixo na caixa e clique Verificar:
{"formato":"questplus-questoes","versao":1,
 "suportes":[{"ref":"s1","titulo":"[TESTE] Apoio importado","texto":"Texto de apoio vindo da importação."}],
 "questoes":[
  {"tipo":"mc","enunciado":"[TESTE] Q1 - qual a capital do Brasil?","alternativas":["A) Rio de Janeiro","B) Brasília","C) São Paulo","D) Salvador"],"correta":"B","explicacao":"Brasília é a capital desde 1960.","pontos":2,"etiquetas":["teste","geografia"],"suporte":"s1"},
  {"tipo":"mc","enunciado":"[TESTE] Q2 - quanto é 2 + 2?","alternativas":["3","4","5","6"],"correta":1,"pontos":2,"etiquetas":["teste","matematica"]},
  {"tipo":"VF","enunciado":"[TESTE] Q3 - julgue os itens:","afirmacoes":[{"texto":"O Sol é uma estrela","valor":"V"},{"texto":"A Lua é uma estrela","valor":"F"}],"pontos":4,"etiquetas":["teste","ciencias"]},
  {"tipo":"mc","enunciado":"[TESTE] Q4 - sem gabarito (deve dar erro)","alternativas":["a","b","c","d"]}
 ]}
 Esperado: 3 novas e 1 com erro (gabarito). A tabela mostra o gabarito: Q1 "B) Brasília", Q2 "B) 4", Q3 "V F".
3.3 Importe as 3. Esperado: 3 criadas, 1 texto de apoio, 1 com erro.
3.4 Cole o MESMO JSON e verifique de novo: "3 já existem" e o botão de importar desabilitado (0).
3.5 Em Questões, filtros EM TEMPO REAL (sem botão): digite "capital" na busca → a lista filtra sozinha; escolha a etiqueta "teste" → 3; formato Verdadeiro/Falso → 1; "Limpar filtros".
3.6 Clique no enunciado da Q1: abre as alternativas com "✔ gabarito" na B, a explicação e "Tem texto de apoio".
3.7 Duplicar a Q2: abre a cópia com aviso "Cópia criada"; volte à lista: +1 questão.
3.8 Excluir a cópia: o modal mostra a questão e o aviso; Cancelar mantém; Esc fecha; "Excluir questão" remove.
3.9 Abra https://questplus.pages.dev/api/admin/questoes/exportar?etiqueta=teste em outra aba: deve baixar um .json (relate o nome do arquivo). Se conseguir ler o conteúdo, relate "formato", a quantidade de questões e de suportes.

ETAPA 4 - ATIVIDADES
4.1 Nova atividade: título "[TESTE] Treino", código teste-treino, turma [TESTE] Turma A, modo Treino. No seletor, filtre pela etiqueta "teste" e use "Adicionar todas as 3 do filtro". Criar: aparece o aviso com o link; "Copiar link" muda para "Copiado ✔". O link é https://questplus.pages.dev/teste-treino.
4.2 Nova atividade: "[TESTE] Prova", código teste-prova, modo Prova. Confira que ao escolher Prova as opções mudam (60 min, 1 tentativa, embaralhar ligado). Ajuste: tempo 10, tentativas 2, DESMARQUE embaralhar, MARQUE "Mostrar a nota ao aluno", turma [TESTE] Turma A, as mesmas 3 questões.
4.3 Tente criar outra com código teste-treino → erro "já está em uso". Com código admin → "reservado".
4.4 Clonar "[TESTE] Treino": a cópia abre com aviso, inativa, título "Cópia de [TESTE] Treino". Exclua a cópia (modal simples, sem caixa de ciência).
4.5 Tente excluir a questão Q1: o modal deve recusar e listar as duas atividades.

ETAPA 5 - ALUNO NO TREINO (aba nova)
5.1 Abra https://questplus.pages.dev/teste-treino → vai para /a/teste-treino e mostra as regras do Treino.
5.2 Entre: nome "Aluno Um", turma [TESTE] Turma A, e-mail aluno1@teste.com → Começar.
5.3 Aparecem "Questão 1 de 3", a barra de progresso e "0 de 3 respondidas". Na Q1 (com texto de apoio) marque A) Rio de Janeiro → Responder: "Incorreta", 0 de 2, gabarito na B, explicação; a resposta fica travada.
5.4 Próxima. Q2: marque "3" → Responder. Próxima. Q3: Verdadeiro nas DUAS afirmações → Responder: "Parcialmente correta", 2 de 4.
5.5 Recarregue a página (F5) antes de finalizar: "Continuar de onde parei" mantém o progresso.
5.6 Finalizar: "Obrigado por participar", "2 de 8 pontos", e o incentivo "Continue praticando! Refaça ... até acertar todas as questões".
5.7 "Refazer a atividade": agora Q1 B, Q2 "4", Q3 Verdadeiro e Falso → "8 de 8 pontos" e "Parabéns", sem pedir para refazer.

ETAPA 6 - ALUNO NA PROVA (aba nova)
6.1 Abra https://questplus.pages.dev/teste-prova: as regras mostram Prova, 10 minutos, Tentativas: 2, "O gabarito não será mostrado" e "Você verá sua nota ao final".
6.2 Aluno Um (aluno1@teste.com), tentativa 1: o cronômetro aparece; NÃO há botão "Responder"; ao marcar aparece "Resposta salva" sozinho. Marque Q1=A (errada), mude para C e confira que a troca vale; Q2=B ("4"); Q3 Verdadeiro e Falso (certas). Tente recarregar a aba: o navegador deve avisar antes de sair (cancele). Em nenhum momento aparece gabarito ou explicação.
6.3 Finalizar: nota "6 de 8 pontos", "Você ainda tem 1 tentativa. Será considerada a maior nota.", e NENHUM gabarito/revisão ("O gabarito não é divulgado nesta atividade").
6.4 Tentativa 2 (botão "Fazer outra tentativa"): Q1=B, Q2=B, Q3 Verdadeiro e Falso → "8 de 8 pontos" e "Você usou todas as tentativas. Aguarde o retorno detalhado da correção da prova pelo professor." Sem botão de nova tentativa.
6.5 Tente a 3ª: recarregue /teste-prova e entre com o mesmo e-mail → erro "Você já usou todas as tentativas".
6.6 Aluno Dois (aluno2@teste.com, [TESTE] Turma A), 1 tentativa: Q1=B, Q2="3", Q3 só a 1ª afirmação como Verdadeiro (deixe a outra em branco) → finalize: "4 de 8 pontos" e "Você ainda tem 1 tentativa".

ETAPA 7 - RELATÓRIOS (painel)
7.1 Atividades → "[TESTE] Prova" → Relatório. Esperado: Alunos 2; Média 75% (6 pontos); Mediana 75%; Maior·menor 100% · 50%; distribuição: 40-60% = 1 aluno e 80-100% = 1 aluno; aproveitamento por questão Q1 100%, Q2 50%, Q3 75% (Q3 tem 1 em branco? não: 0 em branco). Alunos: Aluno Um, 2 tentativas, 8 / 8, 100%, pontos 2,2,4; Aluno Dois, 1 tentativa, 4 / 8, 50%, pontos 2,0,2.
7.2 Filtro "Filtrar por turma": [TESTE] Turma A mantém os mesmos números; "Todas" volta.
7.3 "Exportar JSON" e "Exportar CSV": cada um baixa um arquivo (relate os nomes). Se puder executar JavaScript no console de uma aba do painel, rode e relate a saída (troque ID pelo número da atividade na URL):
  (async()=>{const r=await fetch('/api/admin/atividades/ID/respostas?formato=json');const j=await r.json();console.log(r.status,j.alunos.length,j.tentativas.length)})()
  Esperado: 200 2 3.
7.4 "Imprimir": abre a visualização de impressão? Fundo branco, sem menu nem botões, tabela legível? Se não conseguir ver a prévia, NÃO VERIFICADO.
7.5 Tentativas → Aluno Um, tentativa 2 → "Relatório": cabeçalho "Tentativa 2 de 2 (maior nota)", "8 de 8"; Q1 mostra a resposta do aluno e "✔ gabarito" na mesma alternativa e a explicação. Desmarque "Mostrar gabarito e explicações": gabarito e explicação somem e a resposta do aluno continua. Desmarque "Mostrar textos de apoio": o apoio da Q1 some.
7.6 "Relatórios individuais" (todos os alunos): carrega 2 relatórios e o botão Imprimir habilita.
7.7 Inicie uma tentativa do Aluno Três (aluno3@teste.com) na prova e NÃO finalize. No painel, Tentativas: clique "+ tempo" (5 min) nela: aparece "+5 min". No aluno, o cronômetro aumenta ~5 min após recarregar.
7.8 Anule a tentativa 2 do Aluno Um (modal de confirmação). O relatório da atividade passa a: Aluno Um 1 tentativa, 6 / 8 (75%); Média 62,5%; Maior·menor 75% · 50%; Aluno Três (em andamento) não aparece. A tentativa anulada aparece riscada na lista.

ETAPA 8 - USABILIDADE E LIMITES
8.1 https://questplus.pages.dev/naoexiste123 → "Página não encontrada" com link para o início.
8.2 Painel (/admin): números de questões, turmas e atividades coerentes com o que você viu; a atividade aberta aparece em "Atividades abertas agora".
8.3 Crie a Prova "[TESTE] Relâmpago" (código teste-1min, tempo 1 minuto, 1 tentativa, as 3 questões, [TESTE] Turma A). Como aluno, abra: aparece "Falta menos de 1 minuto". Espere 1 minuto sem finalizar e confira se a tentativa termina sozinha (mensagem de fim); tente responder depois.
8.4 Se conseguir reduzir a janela para ~375 px de largura, confira a tela do aluno (sem rolagem lateral). Se não, NÃO VERIFICADO.
8.5 Lentidão: anote qualquer tela que demorou mais de ~3 segundos.

ETAPA 9 - LIMPEZA
Pelo painel, exclua tudo o que começa com [TESTE]: as atividades (as com tentativas pedem marcar a caixa de ciência), os textos de apoio e as questões; as turmas só podem ser inativadas (inative as 2). Confirme que NADA que não seja [TESTE] foi apagado ou alterado.

RELATÓRIO
No GitHub, repositório projetos-ept/questplus, branch relatorios-extensao (se não existir, crie a partir de claude/gallant-bohr-w6rsh1). Não faça commit em outra branch e não abra Pull Request. Crie docs/relatorios/2026-10-06-teste-completo.md com a mensagem de commit "Relatório do teste completo [skip ci]". Estrutura: (1) tabela por etapa e item, com Resultado (OK/FALHA/NÃO VERIFICADO) e Evidência (texto exato visto); (2) seção "Logs do Cloudflare" com erros de CPU ou 500, ou "nenhum"; (3) seção "Resumo" com no máximo 10 linhas: o que falhou, o que não deu para verificar e o que pareceu lento. Responda ao usuário só com o link do arquivo e um resumo de uma linha por etapa.
```
