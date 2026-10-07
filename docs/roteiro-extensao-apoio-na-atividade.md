# Roteiro para a extensão: SQL 0008 (apoio na atividade)

Faça isto no painel Cloudflare **antes** de publicar o código novo. A extensão nunca digita segredos.

1. Abra Cloudflare → Workers & Pages → D1 → banco `questplus` → aba **Console**.
2. Cole e execute **uma instrução por vez** (não cole as três juntas):
   1. `ALTER TABLE atividades ADD COLUMN suporte_id INTEGER REFERENCES suportes(id);`
   2. `ALTER TABLE tentativas ADD COLUMN suporte TEXT;`
   3. `ALTER TABLE suportes ADD COLUMN etiquetas TEXT NOT NULL DEFAULT '[]';`
3. Confira cada uma com: `PRAGMA table_info(atividades);`, `PRAGMA table_info(tentativas);` e `PRAGMA table_info(suportes);`. Devem aparecer `suporte_id`, `suporte` e `etiquetas`.
   - Se aparecer "duplicate column name", a coluna já existe: siga em frente.
4. (Opcional) R2 → bucket `questplus-midia`: imagens órfãs da limpeza manual podem ser apagadas (nada no banco as usa mais).
5. Avise o Claude Code que as 3 colunas existem. Só então ele publica (push) o código.
6. Depois do deploy: importe textos de apoio em `/admin/suportes/importar`, as questões em `/admin/questoes/importar`, e crie a atividade escolhendo o apoio.
