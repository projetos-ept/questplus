# Questões abertas com correção por IA: proposta

Pedido: o professor recebe um relatório com a **% de aproximação** da resposta do aluno em relação à resposta verdadeira, calculada por aproximação semântica. Esta proposta mantém isso e acrescenta uma proteção, porque semelhança de texto não é o mesmo que acerto.

## O problema da semelhança sozinha

Embeddings medem se dois textos falam do mesmo assunto, não se dizem a mesma coisa. "A insulina **aumenta** a glicemia" e "A insulina **reduz** a glicemia" ficam quase idênticos para um embedding, e o primeiro está errado. Por isso a % de aproximação entra como **sinal de apoio**, nunca como a nota.

## Proposta (híbrida)

| Parte | Quem faz | Mostra ao professor |
| --- | --- | --- |
| Nível de 0 a 4 pela rubrica, conceitos presentes e faltantes, erro conceitual, justificativa curta | Modelo de linguagem (Workers AI), com a resposta do aluno isolada como dado | Sugestão de nota, a confirmar |
| **% de aproximação** com a resposta de referência | Embeddings (similaridade de cosseno) | A % ao lado do nível |
| Alertas de divergência | Regras sobre os dois números | "Atenção: texto muito parecido, mas o modelo vê erro de conceito" (≥ 80% de aproximação com nível ≤ 1); "Texto diferente, mas o modelo vê resposta boa" (< 40% com nível ≥ 3); "Respostas quase idênticas entre alunos" (≥ 95%, possível cópia) |

O que o professor recebe por questão aberta: distribuição dos níveis, média de aproximação, e a lista de respostas ordenada pela maior divergência entre os dois números (as que mais precisam de olho humano). Por aluno: nível, %, conceitos presentes e faltantes, justificativa, e o botão de confirmar ou ajustar. A nota final só existe depois da confirmação.

## Pré-processamento (decidido: o máximo de instruções predefinidas antes da IA)

Quanto mais o sistema decide por regra, mais barato, previsível e auditável fica, e menos o modelo precisa "adivinhar". Antes de chamar qualquer modelo:

1. **Triagem sem IA** (nota 0 automática, sem gastar cota): resposta em branco, curta demais (abaixo de um mínimo definido na questão), só pontuação ou caracteres repetidos, ou que apenas copia o enunciado.
2. **Normalização:** caixa baixa, sem acentos, espaços e pontuação padronizados, abreviações comuns expandidas por um glossário da disciplina.
3. **Conferência de conceitos por regra:** o professor cadastra em cada conceito-chave os **sinônimos aceitos** (ex.: "captação de glicose", "entrada de glicose na célula"). O sistema marca quais conceitos aparecem no texto e entrega isso ao modelo como **evidência**, não como veredito.
4. **Pares de oposição:** lista de antônimos da disciplina (aumenta/reduz, inibe/estimula, hiper/hipo). Se a resposta usa o lado oposto ao da referência, o sistema levanta um alerta de **possível erro conceitual** e o modelo é instruído a olhar aquele ponto.
5. **Limite de tamanho** (1200 caracteres) e **texto do aluno isolado como dado**, com a instrução fixa de ignorar ordens escritas dentro dele.
6. **Rubrica fixa em JSON:** o modelo só pode responder no esquema combinado (nível 0 a 4, conceitos presentes e faltantes, erro conceitual, justificativa de uma frase), validado antes de gravar; resposta fora do esquema vai para revisão manual.
7. Depois, o cálculo da **% de aproximação** (embeddings) e os alertas de divergência.

Para isso, o cadastro da questão aberta ganha: resposta de referência, 3 a 6 conceitos com sinônimos, pares de oposição opcionais, mínimo de caracteres e tabela de pontos por nível.

## Fluxo técnico

1. O aluno finaliza; cada resposta aberta vira uma mensagem na fila (Queues).
2. O consumidor chama o modelo (JSON validado) e o modelo de embeddings, e grava em `correcoes_ia`, com a coluna nova `similaridade`, o modelo e a versão do prompt.
3. A resposta fica "pendente" na fila de revisão; o professor confirma, e só então entra em `pontos_final`.

## O que ainda precisa ser decidido ou medido

- **Modelo de embeddings:** a pesquisa da extensão listou só modelos de texto. É preciso conferir, no catálogo do Workers AI, a categoria de embeddings e escolher um **multilíngue** (o bge-m3 é o candidato; a disponibilidade e o custo em neurônios não foram verificados).
- **Modelo de linguagem:** no teste do playground, o `glm-4.7-flash` devolveu JSON limpo nas 3 execuções e não obedeceu à injeção de instrução; `llama-3.3-70b` e `qwen3-30b` acertaram os níveis, mas a tela mostrou trechos duplicados (pode ser do playground). A escolha final depende de repetir o teste pela API real.
- **Cota:** 10.000 neurônios por dia e 10.000 operações de fila por dia (cerca de 3.300 mensagens). Uma atividade com 40 alunos e 3 abertas gera 120 mensagens. O consumo real por resposta ainda não foi medido.
- **Calibração:** antes do uso real, cerca de 30 respostas corrigidas à mão comparadas com a IA, ajustando os descritores (já previsto na documentação do projeto).
- **Privacidade:** o modelo recebe só o texto da resposta, sem nome nem e-mail; limite de 1200 caracteres por resposta.
- **Quem vê a %:** só o professor.
