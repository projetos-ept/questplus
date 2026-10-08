# Roteiro para a extensão: SQL 0011 (nome do professor nos relatórios)

Faça no painel Cloudflare **antes** de publicar o código novo. A extensão nunca digita segredos.

1. Cloudflare → Workers & Pages → D1 → banco `questplus` → aba **Console**.
2. Confira se a tabela já existe: `SELECT name FROM sqlite_master WHERE name = 'configuracoes';` (0 linhas = ainda não existe).
3. Se não existe, execute **só esta instrução**:
   `CREATE TABLE configuracoes (chave TEXT PRIMARY KEY, valor TEXT NOT NULL);`
   ("already exists" = já existia, siga em frente.)
4. Confira de novo a consulta do passo 2: deve voltar 1 linha.
5. Não execute `DROP`, `DELETE` nem `UPDATE`. Se algo pedir login diferente, pare e avise.
6. Avise o Claude Code que a tabela existe. Só então ele publica.
