ALTER TABLE suportes ADD COLUMN imagens TEXT NOT NULL DEFAULT '[]';
UPDATE suportes SET imagens = json_array(json_object('n', 1, 'chave', imagem_chave, 'legenda', '', 'tamanho', 'media', 'largura', NULL, 'origem', NULL)) WHERE imagem_chave IS NOT NULL;
