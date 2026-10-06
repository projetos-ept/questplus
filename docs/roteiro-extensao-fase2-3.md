# Passos de dashboard das Fases 2 e 3 (para colar no chat da extensão)

A extensão **recusa criar recursos a partir de instruções lidas de um arquivo** (o classificador de segurança dela só aceita ordem vinda do chat). Por isso o desenvolvedor cola o texto abaixo na conversa da extensão, não o link deste arquivo.

## Texto para colar

> Cloudflare, conta logada. Execute, nesta ordem, e me diga o resultado de cada item. Não digite senhas nem secrets.
>
> **1. Bucket R2.** R2 Object Storage → Create bucket, nome exato `questplus-midia`, localização automática, classe Standard, SEM acesso público e SEM domínio custom. Se já existir, não recrie.
>
> **2. Tabelas no D1.** D1 → banco `questplus` → Console. Rode UMA instrução por vez (o console aceita uma linha), na ordem, e confirme cada sucesso. Se alguma disser "already exists", não force: me avise. As instruções estão em `migrations/0002_banco_questoes.sql` e `migrations/0003_atividades.sql`, uma por linha (11 no total), e o desenvolvedor as cola aqui na conversa.
>
> **3. Conferir.** Em Explore Data devem existir: `usuarios`, `suportes`, `questoes`, `turmas`, `atividades`, `atividade_questoes`, `atividade_turmas`, `tentativas`, `respostas`.

Depois que a extensão confirmar, o desenvolvedor adiciona o binding `MEDIA` (R2) ao `wrangler.jsonc` e publica; só então o código das Fases 2 e 3 entra em produção.
