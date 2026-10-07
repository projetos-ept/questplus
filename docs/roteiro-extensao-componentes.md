# Roteiro para a extensão: SQL 0009 (componente curricular)

Faça no painel Cloudflare **antes** de publicar o código novo. A extensão nunca digita segredos.

1. Cloudflare → Workers & Pages → D1 → banco `questplus` → aba **Console**.
2. Execute **uma instrução por vez**:
   1. ```
      CREATE TABLE componentes (id INTEGER PRIMARY KEY AUTOINCREMENT, nome TEXT NOT NULL UNIQUE COLLATE NOCASE, criado_em TEXT NOT NULL DEFAULT (datetime('now')));
      ```
   2. `ALTER TABLE atividades ADD COLUMN componente_id INTEGER REFERENCES componentes(id);`
3. Confira: `SELECT name FROM sqlite_master WHERE name = 'componentes';` (deve voltar 1 linha) e `SELECT name FROM pragma_table_info('atividades') WHERE name = 'componente_id';` (1 linha).
   - "table componentes already exists" ou "duplicate column name": já existe, siga em frente.
4. Avise o Claude Code que as duas existem. Só então ele publica.
