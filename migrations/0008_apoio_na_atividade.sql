ALTER TABLE atividades ADD COLUMN suporte_id INTEGER REFERENCES suportes(id);
ALTER TABLE tentativas ADD COLUMN suporte TEXT;
ALTER TABLE suportes ADD COLUMN etiquetas TEXT NOT NULL DEFAULT '[]';
