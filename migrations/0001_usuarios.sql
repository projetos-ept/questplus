CREATE TABLE usuarios (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	email TEXT NOT NULL UNIQUE COLLATE NOCASE,
	senha_hash TEXT NOT NULL,
	papel TEXT NOT NULL DEFAULT 'professor' CHECK (papel IN ('professor', 'admin')),
	criado_em TEXT NOT NULL DEFAULT (datetime('now'))
);
