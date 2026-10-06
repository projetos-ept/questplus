# Passos de dashboard das Fases 2 e 3 (para colar no chat da extensão)

A extensão **recusa criar recursos a partir de instruções lidas de um arquivo** (o classificador de segurança dela só aceita ordem vinda do chat). Por isso o desenvolvedor cola o texto abaixo na conversa da extensão, não o link deste arquivo.

## Texto para colar

> Cloudflare, conta logada. Execute, nesta ordem, e me diga o resultado de cada item. Não digite senhas nem secrets.
>
> **1. Bucket R2.** R2 Object Storage → Create bucket, nome exato `questplus-midia`, localização automática, classe Standard, SEM acesso público e SEM domínio custom. Se já existir, não recrie.
>
> **2. Tabelas no D1.** D1 → banco `questplus` → Console. Rode UMA instrução por vez (o console aceita uma linha), na ordem, e confirme cada sucesso. Se alguma disser "already exists", não force: me avise. As instruções estão em `migrations/0002_banco_questoes.sql` e `migrations/0003_atividades.sql`, uma por linha (10 no total), e o desenvolvedor as cola aqui na conversa.
>
> **3. Conferir.** Em Explore Data devem existir: `usuarios`, `suportes`, `questoes`, `turmas`, `atividades`, `atividade_questoes`, `atividade_turmas`, `tentativas`, `respostas`.

Depois que a extensão confirmar, o desenvolvedor adiciona o binding `MEDIA` (R2) ao `wrangler.jsonc` e publica; só então o código das Fases 2 e 3 entra em produção.


## Fase 4 (modo Prova): 2 instruções SQL

`migrations/0004_modo_prova.sql`. **Têm de rodar no D1 antes de publicar o código**, porque o código novo grava e lê essas colunas. Uma instrução por vez:

```sql
ALTER TABLE atividades ADD COLUMN mostra_nota INTEGER NOT NULL DEFAULT 0;
```
```sql
ALTER TABLE tentativas ADD COLUMN anulada INTEGER NOT NULL DEFAULT 0;
```

Depois, em Explore Data, as tabelas `atividades` e `tentativas` devem mostrar as colunas `mostra_nota` e `anulada`. Os dados existentes não mudam (a coluna entra com 0).


## Textos de apoio com várias imagens: 2 instruções SQL

`migrations/0005_suportes_imagens.sql`. **Também têm de rodar no D1 antes de publicar.** Uma instrução por vez; a segunda leva as imagens que já existem para o formato novo:

```sql
ALTER TABLE suportes ADD COLUMN imagens TEXT NOT NULL DEFAULT '[]';
```
```sql
UPDATE suportes SET imagens = json_array(json_object('n', 1, 'chave', imagem_chave, 'legenda', '', 'tamanho', 'media', 'largura', NULL, 'origem', NULL)) WHERE imagem_chave IS NOT NULL;
```

Depois, em Explore Data → `suportes`, a coluna `imagens` deve existir e, nas linhas que tinham imagem, conter algo como `[{"n":1,"chave":"…png",…}]`.


## Limite por endereço de rede: 1 instrução SQL

`migrations/0006_limites.sql`. Também antes de publicar:

```sql
CREATE TABLE limites (chave TEXT PRIMARY KEY, inicio TEXT NOT NULL, n INTEGER NOT NULL DEFAULT 0);
```

Depois, em Explore Data, deve existir a tabela `limites` (vazia).
