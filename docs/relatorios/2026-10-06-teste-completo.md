# Teste completo em produção (extensão do Chrome), 06/10/2026

Build testado: `70e1076`/`d4de6e1` (sem as correções de V ou F e do modal de excluir questão, publicadas depois).
Relatório reconstruído a partir das mensagens da extensão, que não conseguiu gravá-lo no GitHub (token inválido e verificador de segurança do navegador fora do ar).

## Resultado por etapa

| Etapa | Resultado |
|---|---|
| 0 Deploy e acesso | OK |
| 1 Turmas | OK |
| 2 Textos de apoio | OK. **2.6** (envio de arquivo do computador) NÃO VERIFICADO |
| 3 Importação/exportação | OK (3.1–3.9). 3.9 lido por requisição, não pelo download |
| 4 Questões | OK, exceto **4.5** (ver divergências) |
| 5 Treino (aluno) | OK: 2/8 → 8/8 |
| 6 Prova (aluno) | OK: Aluno Um 6/8 → 8/8, 3ª tentativa recusada, Aluno Dois 4/8. Recarregar no meio da prova não executado (só confirmado o aviso de saída) |
| 7 Painel/relatórios | 7.1–7.3, 7.5–7.7 OK; **7.4** (imprimir) NÃO VERIFICADO; 7.8 e 7.9 OK com divergência |
| 8 Geral | 8.1 OK, 8.2 OK, 8.3 OK em parte, 8.4 NÃO VERIFICADO, 8.5 sem medição, 8.6 NÃO VERIFICADO (por instrução) |
| 9 Limpeza | Não executada: itens `[TESTE]` continuam no sistema |

Nenhuma tela deu erro 500 ou ficou em branco. Real-time logs do Cloudflare não foram abertos (seção de logs não verificada).

## Divergências e decisão

1. **4.5, modal de excluir questão não avisava que ela está em atividades.** O servidor recusava depois da confirmação. **Corrigido** (commit `afc8196`+seguinte): o modal avisa antes e bloqueia o botão.
2. **7.8, tentativa em andamento do Aluno Três virou 0/8 e entrou nas médias.** Comportamento esperado do sistema: tentativa vencida é encerrada sozinha com a nota das respostas dadas (aqui, nenhuma), e conta como finalizada. O roteiro esperava que ficasse oculta; o roteiro é que deve ser ajustado.
3. **8.3, não foi possível testar a recusa de resposta após o prazo pela tela** (os campos somem). A recusa no servidor é coberta por teste de API.
4. **Interrupção do teste:** o aviso nativo "Sair da página?" da Prova travou a extensão (abas de aluno em andamento). É função intencional para o aluno; o roteiro deve evitar fechar abas de aluno durante a prova.

## Itens que dependem de janela do navegador (verificar manualmente)

2.6 envio de arquivo; 7.4 impressão; 8.4 largura de celular; 9 limpeza dos itens `[TESTE]`.

## Observação sobre dados

Durante o teste o dono do sistema mexeu nos dados (questões de coleta de sangue e a atividade "[COLETA]"). Não foram criadas pela extensão nem pelo desenvolvimento.
