# Roteiro para a extensão: SQL 0010 (peso da atividade)

Faça no painel Cloudflare **antes** de publicar o código novo. A extensão nunca digita segredos.

1. Cloudflare → Workers & Pages → D1 → banco `questplus` → aba **Console**.
2. Execute esta instrução:
   `ALTER TABLE atividades ADD COLUMN peso REAL;`
3. Confira: `SELECT name FROM pragma_table_info('atividades') WHERE name = 'peso';` (deve voltar 1 linha).
   - "duplicate column name": já existe, siga em frente.
4. Avise o Claude Code que a coluna existe. Só então ele publica.
