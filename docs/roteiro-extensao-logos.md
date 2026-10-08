# Roteiro para a extensão: SQL 0012 (logos)

Faça no painel Cloudflare **antes** de publicar o código novo. A extensão nunca digita segredos. Faça **uma instrução por vez**.

1. Cloudflare → Workers & Pages → D1 → banco `questplus` → aba **Console**.
2. Confira o que já existe (anote o resultado):
   - `SELECT name FROM sqlite_master WHERE name = 'logos';`
   - `SELECT name FROM pragma_table_info('atividades') WHERE name = 'logo_id';`
3. Instrução 1, só se a tabela `logos` **não** existe (0 linhas no primeiro item do passo 2):
   `CREATE TABLE logos (id INTEGER PRIMARY KEY AUTOINCREMENT, nome TEXT NOT NULL, chave TEXT NOT NULL, criado_em TEXT NOT NULL DEFAULT (datetime('now')));`
4. Instrução 2, só se a coluna `logo_id` **não** existe (0 linhas no segundo item do passo 2):
   `ALTER TABLE atividades ADD COLUMN logo_id INTEGER REFERENCES logos(id);`
   ("already exists" ou "duplicate column name" = já existia, siga em frente.)
5. Confira de novo as duas consultas do passo 2: cada uma deve voltar 1 linha.
6. Confirme as colunas: `SELECT name FROM pragma_table_info('logos');` deve listar `id, nome, chave, criado_em`.
7. Não execute `DROP`, `DELETE` nem `UPDATE`. Não digite senhas nem tokens. Se algo pedir login diferente, pare e avise.

Responda com o resultado de cada consulta (antes e depois), a mensagem de cada instrução executada (ou "pulei, já existia") e as colunas do passo 6.
