import { describe, expect, it } from 'vitest';
import { montarSnapshot, versaoAluno } from './atividade';
import { montarExportacao, normalizarQuestao } from './importacao';
import { imagemDe, validarImagemUnica } from './imagens';
import { entradaDe, formularioDe, validarQuestao } from './questao';

const chave = '123e4567-e89b-12d3-a456-426614174000.png';
const img = { chave, legenda: 'ECG', tamanho: 'grande', largura: null, origem: null };
const mc = (extra: object = {}) => ({ tipo: 'mc', enunciado: 'Qual?', config: { alternativas: ['a', 'b', 'c', 'd'], correta: 1 }, ...extra });

describe('imagem única da questão', () => {
	it('valida: opcional, com tamanho e legenda', () => {
		expect(validarImagemUnica(undefined)).toEqual({ ok: true, valor: null });
		const r = validarImagemUnica(img);
		expect(r.ok && r.valor).toMatchObject({ n: 1, chave, legenda: 'ECG', tamanho: 'grande' });
		expect(validarImagemUnica({ ...img, chave: 'x.png' }).ok).toBe(false);
		expect(validarImagemUnica({ ...img, tamanho: 'personalizada', largura: 10 }).ok).toBe(false);
		expect(validarImagemUnica([img]).ok).toBe(false);
	});
	it('a questão guarda a imagem dentro do config, sem coluna nova', () => {
		const r = validarQuestao(mc({ imagem: img }));
		expect(r.ok && imagemDe(r.valor.config)?.chave).toBe(chave);
		expect(validarQuestao(mc()).ok && imagemDe((validarQuestao(mc()) as { valor: { config: unknown } }).valor.config)).toBeNull();
		expect(validarQuestao(mc({ imagem: { ...img, chave: 'ruim' } })).ok).toBe(false);
	});
	it('funciona nos três formatos', () => {
		const vf = validarQuestao({ tipo: 'vf', enunciado: 'x', imagem: img, config: { afirmacoes: [{ texto: 'a', valor: true }] } });
		const ab = validarQuestao({ tipo: 'aberta', enunciado: 'x', imagem: img, config: { referencia: 'r', conceitos: [{ nome: 'c', sinonimos: [] }] } });
		expect(vf.ok && imagemDe(vf.valor.config)?.chave).toBe(chave);
		expect(ab.ok && imagemDe(ab.valor.config)?.chave).toBe(chave);
	});
	it('formulário: ida e volta', () => {
		const q = validarQuestao(mc({ imagem: img }));
		if (!q.ok) throw new Error('x');
		const f = formularioDe({ ...q.valor, etiquetas: [] });
		expect(f.imagem?.chave).toBe(chave);
		const volta = validarQuestao(entradaDe({ ...f, correta: 1 }));
		expect(volta.ok && imagemDe(volta.valor.config)?.legenda).toBe('ECG');
	});
	it('o embaralhamento da prova não perde a imagem', () => {
		const q = validarQuestao(mc({ imagem: img }));
		if (!q.ok) throw new Error('x');
		const s = montarSnapshot({ id: 1, tipo: 'mc', enunciado: 'x', config: q.valor.config, explicacao: null, pontos: 1 }, true, () => 0.3);
		expect(imagemDe(s.config)?.chave).toBe(chave);
		expect(versaoAluno(s).imagem?.chave).toBe(chave);
	});
	it('o aluno recebe a imagem, mas nunca o gabarito', () => {
		const q = validarQuestao(mc({ imagem: img }));
		if (!q.ok) throw new Error('x');
		const v = versaoAluno({ id: 1, tipo: 'mc', enunciado: 'x', config: q.valor.config, explicacao: 'segredo', pontos: 1 });
		expect(JSON.stringify(v)).not.toMatch(/correta|segredo/);
		expect(v.imagem?.legenda).toBe('ECG');
	});
});

describe('exportar e importar questão com imagem', () => {
	it('sai sem a imagem e com a observação [img]', () => {
		const q = validarQuestao(mc({ imagem: img }));
		if (!q.ok) throw new Error('x');
		const arq = montarExportacao([q.valor] as never);
		const item = arq.questoes[0] as { config: Record<string, unknown>; observacao?: string };
		expect(item.config.imagem).toBeUndefined();
		expect(item.observacao).toMatch(/^\[img\]/);
		expect(item.observacao).toContain('ECG');
	});
	it('questão sem imagem não ganha observação', () => {
		const q = validarQuestao(mc());
		if (!q.ok) throw new Error('x');
		expect((montarExportacao([q.valor] as never).questoes[0] as { observacao?: string }).observacao).toBeUndefined();
	});
	it('ao importar, a observação [img] vira aviso (tinha_imagem)', () => {
		const r = normalizarQuestao({ ...mc(), alternativas: ['a', 'b', 'c', 'd'], correta: 1, observacao: '[img] Esta questão tem uma imagem' });
		expect(r.ok && r.valor.tinha_imagem).toBe(true);
		const sem = normalizarQuestao({ ...mc(), alternativas: ['a', 'b', 'c', 'd'], correta: 1 });
		expect(sem.ok && sem.valor.tinha_imagem).toBe(false);
	});
});
