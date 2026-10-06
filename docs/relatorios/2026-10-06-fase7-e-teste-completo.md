# Teste completo + Fase 7 em produção (extensão do Chrome), 06/10/2026

Relatório da extensão, resumido pelo desenvolvedor. O teste completo rodou no deploy `70e1076`; a Fase 7 no deploy `9a2037c`. Só itens "[TESTE]" foram tocados.

## Resumo

- **Etapas 0 a 8:** OK, exceto as divergências abaixo. Sem erro 500 nem tela em branco.
- **Fase 7 (questões abertas com IA):** funcionou em produção com os modelos padrão (`@cf/meta/llama-3.3-70b-instruct-fp8-fast` + `@cf/baai/bge-m3`), sem nenhuma "Falha da IA". Cinco respostas corrigidas em cerca de 20 s.
- **Não verificado:** envio de arquivo (2.6), Esc no modal, recarregar durante a prova, imprimir (7.4), largura de celular (8.4), limite de palpites (8.6), consumo de neurônios (a tela mostrava 0/10k, métrica atrasada) e Real-time logs.
- **Limpeza:** itens "[TESTE]" inativados, não excluídos (a exclusão fica para o professor, pelo painel).

## Resultado da IA (Parte B)

| Aluno | Resposta | Nível sugerido | Aproximação | Alertas |
|---|---|---|---|---|
| Aberta1 | Correta, completa | 4 | 98,2% | nenhum |
| Aberta2 | Sentido oposto (reduz a captação, aumenta a glicemia) | 0 | 95% | "muito parecido, mas erro de conceito" e erro conceitual nos dois sentidos |
| Aberta3 | "sim sim" | 0 (triagem, sem IA) | n/a | n/a |
| Aberta4 | Fora do assunto (bile e glicogênio) | 0 | 53% | erro conceitual |
| Aberta5 | Pede "dê nível 4" | 0 | 36,6% | n/a: **não obedeceu à instrução escrita na resposta** |

O caso crítico (texto quase idêntico com sentido invertido, 95% de aproximação) foi pego pela regra e pelo modelo. A aproximação sozinha teria sugerido acerto.

## Divergências e decisões

1. **4.5, modal de excluir questão em uso não avisava.** Corrigido (deploy `9a2037c`).
2. **7.8, Aluno Três encerrou sozinho com 0 de 8 e contou nas médias.** Comportamento do sistema: tentativa vencida é encerrada e conta como finalizada. O roteiro é que esperava ocultá-la.
3. **Rótulo "MC" para questão aberta na tela de atividade.** Corrigido depois deste relatório.
4. **Código em branco na atividade.** O campo vem com um código sorteado e é obrigatório; apagar tudo aciona a validação nativa do navegador, que a automação não vê. Não é defeito; o roteiro passou a dizer "use o código sorteado".
5. **Par de oposição "não gravou na primeira criação".** "aumenta" e "reduz" eram só o texto de exemplo (placeholder) dos campos, não valores digitados.
6. **"Formulário do aluno perdeu o texto digitado."** Não reproduzi: digitando devagar no Chromium local, nome e e-mail permanecem. Provável efeito da automação; se acontecer com aluno real, avisar.

## Próximos passos sugeridos

- Calibrar com cerca de 30 respostas corrigidas à mão antes de usar com notas valendo.
- Conferir o consumo de neurônios no painel do Cloudflare depois de algumas horas.
