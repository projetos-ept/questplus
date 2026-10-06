import { describe, expect, it } from 'vitest';
import { rotuloDoNivel, alertasDe, conferirConceitos, conferirOposicoes, cosseno, divergenciaDe, normalizar, percentualDe, pontosDoNivel, triar } from './aberta';

const cfg = {
	referencia: 'A insulina aumenta a captação de glicose pelas células e reduz a glicemia.',
	conceitos: [
		{ nome: 'captação de glicose', sinonimos: ['entrada de glicose na célula'] },
		{ nome: 'reduz a glicemia', sinonimos: ['diminui o açúcar no sangue'] }
	],
	oposicoes: [['aumenta', 'reduz']] as [string, string][],
	min_chars: 20,
	pontos_por_nivel: [0, 25, 50, 75, 100]
};

describe('normalizar', () => {
	it('tira acento, caixa e pontuação', () => expect(normalizar('  Captação,  de GLICOSE! ')).toBe('captacao de glicose'));
});

describe('triar', () => {
	const t = (r: string) => triar(r, 'Explique o papel da insulina na regulação da glicemia.', cfg);
	it('aceita resposta normal', () => expect(t('A insulina leva a glicose para dentro da célula.')).toEqual({ ok: true }));
	it('recusa branco, curta, símbolos, repetição e cópia', () => {
		expect(t('   ').ok).toBe(false);
		expect(t('insulina').ok).toBe(false);
		expect(t('?????!!!!!!!!!!!!!!!!!!!!').ok).toBe(false);
		expect(t('não sei não sei não sei não sei').ok).toBe(true); // repetição de frase não é a mesma palavra
		expect(t('sim sim sim sim sim sim sim sim sim sim').ok).toBe(false);
		expect(t('aaaaaaaaaaaaaaaaaaaaaaaaaaaaaa').ok).toBe(false);
		expect(t('Explique o papel da insulina na regulação da glicemia').ok).toBe(false);
	});
	it('mínimo 0 aceita resposta curta', () => expect(triar('ok', 'x', { min_chars: 0 }).ok).toBe(true));
});

describe('conferirConceitos', () => {
	it('acha por nome, por sinônimo e marca ausente', () => {
		const r = conferirConceitos('Ela facilita a ENTRADA de glicose na célula.', cfg);
		expect(r.map((x) => x.presente)).toEqual([true, false]);
		expect(r[0].termo).toBe('entrada de glicose na célula');
	});
	it('não confunde palavra parcial', () => {
		expect(conferirConceitos('a captação de glicosee', cfg)[0].presente).toBe(false);
	});
});

describe('conferirOposicoes', () => {
	it('levanta alerta quando a resposta usa só o lado oposto', () => {
		const r = conferirOposicoes('A insulina reduz a captação de glicose.', { ...cfg, referencia: 'A insulina aumenta a captação de glicose.' });
		expect(r).toEqual([{ lado_referencia: 'aumenta', lado_oposto: 'reduz' }]);
	});
	it('não levanta quando usa o mesmo lado da referência', () => {
		expect(conferirOposicoes('A insulina aumenta a captação.', { ...cfg, referencia: 'A insulina aumenta a captação de glicose.' })).toEqual([]);
	});
	it('referência com os dois lados: pega a troca de lados pelo contexto', () => {
		const r = conferirOposicoes('A insulina reduz a captação de glicose e aumenta a glicemia.', cfg);
		expect(r.map((x) => x.lado_oposto).sort()).toEqual(['aumenta', 'reduz']);
	});
	it('referência com os dois lados: resposta certa não levanta alerta', () => {
		expect(conferirOposicoes('A insulina aumenta a captação de glicose pelas células e por isso reduz a glicemia.', cfg)).toEqual([]);
		expect(conferirOposicoes('reduz', cfg)).toEqual([]);
	});
});

describe('indicador qualitativo', () => {
	it('mapeia os níveis 0 a 4', () => {
		expect([0, 1, 2, 3, 4].map(rotuloDoNivel)).toEqual(['Não atende', 'Insuficiente', 'Regular', 'Bom', 'Excelente']);
		expect(rotuloDoNivel(9)).toBe('Excelente');
		expect(rotuloDoNivel(-1)).toBe('Não atende');
	});
});

describe('pontos e alertas', () => {
	it('tabela de pontos por nível', () => {
		expect(pontosDoNivel(0, 4, cfg)).toBe(0);
		expect(pontosDoNivel(2, 4, cfg)).toBe(2);
		expect(pontosDoNivel(4, 4, cfg)).toBe(4);
		expect(pontosDoNivel(9, 4, cfg)).toBe(4);
	});
	it('cosseno e percentual', () => {
		expect(cosseno([1, 0], [1, 0])).toBe(1);
		expect(cosseno([1, 0], [0, 1])).toBe(0);
		expect(cosseno([], [])).toBe(0);
		expect(percentualDe(0.8765)).toBe(87.7);
		expect(percentualDe(-0.3)).toBe(0);
	});
	it('alertas de divergência', () => {
		const o = [] as never[];
		expect(alertasDe({ nivel: 1, aproximacao: 85, oposicoes: o }).map((a) => a.codigo)).toEqual(['parecido_mas_erro']);
		expect(alertasDe({ nivel: 3, aproximacao: 30, oposicoes: o }).map((a) => a.codigo)).toEqual(['diferente_mas_bom']);
		expect(alertasDe({ nivel: 2, aproximacao: 60, oposicoes: o })).toEqual([]);
		expect(alertasDe({ nivel: null, aproximacao: null, oposicoes: o, copia: true }).map((a) => a.codigo)).toEqual(['possivel_copia']);
	});
	it('divergência ordena os casos', () => {
		expect(divergenciaDe(0, 90)).toBeGreaterThan(divergenciaDe(3, 70));
		expect(divergenciaDe(null, 50)).toBe(0);
	});
});

import { extrairJson, similaridadeTexto, validarSaidaIA } from './aberta';

describe('contrato do modelo', () => {
	const ok = { nivel: 3, conceitos_presentes: ['a'], conceitos_faltantes: [], erro_conceitual: false, justificativa: 'Boa resposta.' };
	it('aceita saída válida (inclusive nível como texto)', () => {
		expect(validarSaidaIA(ok).ok).toBe(true);
		expect(validarSaidaIA({ ...ok, nivel: '2' }).ok).toBe(true);
	});
	it('recusa fora do esquema', () => {
		expect(validarSaidaIA({ ...ok, nivel: 7 }).ok).toBe(false);
		expect(validarSaidaIA({ ...ok, nivel: 2.5 }).ok).toBe(false);
		expect(validarSaidaIA({ ...ok, conceitos_presentes: 'a' }).ok).toBe(false);
		expect(validarSaidaIA({ ...ok, erro_conceitual: 'sim' }).ok).toBe(false);
		expect(validarSaidaIA({ ...ok, justificativa: '  ' }).ok).toBe(false);
		expect(validarSaidaIA(null).ok).toBe(false);
	});
	it('extrai JSON de texto com bloco de código ou conversa', () => {
		expect(extrairJson('Claro!\n```json\n{"nivel": 2}\n```')).toEqual({ nivel: 2 });
		expect(extrairJson('sem json')).toBeNull();
		expect(extrairJson('{quebrado')).toBeNull();
		expect(extrairJson({ nivel: 1 })).toEqual({ nivel: 1 });
	});
	it('similaridade de texto', () => {
		expect(similaridadeTexto('a insulina leva a glicose para dentro da célula', 'A insulina leva a glicose para dentro da célula!')).toBe(1);
		expect(similaridadeTexto('a insulina leva a glicose para dentro da célula', 'o fígado produz bile e armazena glicogênio')).toBe(0);
	});
});

import { validarQuestao } from './questao';
import { normalizarQuestao, montarPromptIA, OPCOES_PROMPT_PADRAO } from './importacao';
import { validarResposta } from './correcao';
import { versaoAluno } from './atividade';

describe('questão aberta: cadastro, importação e resposta', () => {
	const base = { tipo: 'aberta', enunciado: 'Explique.', pontos: 4, config: { referencia: 'Resposta modelo.', conceitos: [{ nome: 'a', sinonimos: ['b', 'c'] }] } };
	it('valida e preenche padrões', () => {
		const r = validarQuestao(base);
		expect(r.ok).toBe(true);
		if (r.ok) expect(r.valor.config).toMatchObject({ min_chars: 20, pontos_por_nivel: [0, 25, 50, 75, 100], oposicoes: [] });
	});
	it('recusa rubrica inválida', () => {
		expect(validarQuestao({ ...base, config: { ...base.config, referencia: '' } }).ok).toBe(false);
		expect(validarQuestao({ ...base, config: { ...base.config, conceitos: [] } }).ok).toBe(false);
		expect(validarQuestao({ ...base, config: { ...base.config, pontos_por_nivel: [0, 50, 25, 75, 100] } }).ok).toBe(false);
		expect(validarQuestao({ ...base, config: { ...base.config, pontos_por_nivel: [0, 25] } }).ok).toBe(false);
		expect(validarQuestao({ ...base, config: { ...base.config, min_chars: -1 } }).ok).toBe(false);
		expect(validarQuestao({ ...base, config: { ...base.config, oposicoes: [['só um', '']] } }).ok).toBe(false);
	});
	it('importa com variações comuns', () => {
		const r = normalizarQuestao({ tipo: 'Dissertativa', enunciado: 'X?', referencia: 'Ref', conceitos: ['um', { conceito: 'dois', sinonimos: 'd, dd' }], oposicoes: [['a', 'b'], { a: 'c', b: 'd' }], pontos: 2 });
		expect(r.ok).toBe(true);
		if (r.ok) expect(r.valor.config).toMatchObject({ conceitos: [{ nome: 'um', sinonimos: [] }, { nome: 'dois', sinonimos: ['d', 'dd'] }], oposicoes: [['a', 'b'], ['c', 'd']] });
	});
	it('resposta do aluno: texto obrigatório e limitado', () => {
		expect(validarResposta('aberta', {}, { texto: ' oi ' })).toEqual({ ok: true, valor: { texto: 'oi' } });
		expect(validarResposta('aberta', {}, { texto: '   ' }).ok).toBe(false);
		expect(validarResposta('aberta', {}, { texto: 'a'.repeat(1201) }).ok).toBe(false);
		expect(validarResposta('aberta', {}, {}).ok).toBe(false);
	});
	it('o aluno nunca recebe referência, conceitos nem rubrica', () => {
		const q = validarQuestao(base);
		if (!q.ok) throw new Error('x');
		const v = versaoAluno({ id: 1, tipo: 'aberta', enunciado: 'E', config: q.valor.config, explicacao: 'segredo', pontos: 4, suporte: null });
		expect(JSON.stringify(v)).not.toMatch(/Resposta modelo|conceitos|sinonimos|segredo|pontos_por_nivel/);
		expect(v.config).toEqual({ max_chars: 1200, min_chars: 20 });
	});
	it('prompt da IA só fala de questão aberta quando marcada', () => {
		expect(montarPromptIA(OPCOES_PROMPT_PADRAO)).not.toContain('"tipo": "aberta"');
		const com = montarPromptIA({ ...OPCOES_PROMPT_PADRAO, formatos: { ...OPCOES_PROMPT_PADRAO.formatos, aberta: true } });
		expect(com).toContain('"tipo": "aberta"');
		expect(com).toContain('ou "aberta" (resposta escrita');
		expect(montarPromptIA(OPCOES_PROMPT_PADRAO)).not.toContain('ou "aberta"');
	});
});
