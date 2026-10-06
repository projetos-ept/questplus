import { describe, expect, it } from 'vitest';
import { entradaDe, formularioDe, formularioVazio, validarQuestao, validarSuporte } from './questao';

const mc4 = { tipo: 'mc', enunciado: 'Q?', config: { alternativas: ['a', 'b', 'c', 'd'], correta: 2 } };

describe('validarQuestao', () => {
	it('aceita MC4 e MC5', () => {
		expect(validarQuestao(mc4).ok).toBe(true);
		expect(validarQuestao({ ...mc4, config: { alternativas: ['a', 'b', 'c', 'd', 'e'], correta: 4 } }).ok).toBe(true);
	});
	it('recusa número errado de alternativas, vazias e correta fora do intervalo', () => {
		expect(validarQuestao({ ...mc4, config: { alternativas: ['a', 'b', 'c'], correta: 0 } }).ok).toBe(false);
		expect(validarQuestao({ ...mc4, config: { alternativas: ['a', 'b', '', 'd'], correta: 0 } }).ok).toBe(false);
		expect(validarQuestao({ ...mc4, config: { alternativas: ['a', 'b', 'c', 'd'], correta: 4 } }).ok).toBe(false);
		expect(validarQuestao({ ...mc4, config: { alternativas: ['a', 'b', 'c', 'd'] } }).ok).toBe(false);
	});
	it('valida VF', () => {
		const vf = { tipo: 'vf', enunciado: 'Q', config: { afirmacoes: [{ texto: 'x', valor: true }, { texto: 'y', valor: false }] } };
		expect(validarQuestao(vf).ok).toBe(true);
		expect(validarQuestao({ ...vf, config: { afirmacoes: [] } }).ok).toBe(false);
		expect(validarQuestao({ ...vf, config: { afirmacoes: [{ texto: 'x', valor: 'sim' }] } }).ok).toBe(false);
	});
	it('exige enunciado, pontos válidos e recusa tipos ainda não disponíveis', () => {
		expect(validarQuestao({ ...mc4, enunciado: '  ' }).ok).toBe(false);
		expect(validarQuestao({ ...mc4, pontos: 0 }).ok).toBe(false);
		expect(validarQuestao({ ...mc4, tipo: 'aberta' }).ok).toBe(false);
		expect(validarQuestao(null).ok).toBe(false);
	});
	it('normaliza etiquetas e usa padrões', () => {
		const r = validarQuestao({ ...mc4, etiquetas: ' Parasitologia, parasitologia ,  ,Ciclo ' });
		expect(r.ok && r.valor.etiquetas).toEqual(['parasitologia', 'ciclo']);
		expect(r.ok && r.valor.pontos).toBe(1);
		expect(r.ok && r.valor.ativa).toBe(true);
	});
});

describe('formulário', () => {
	it('ida e volta mantém o conteúdo, e MC4 ignora o 5º campo', () => {
		const f = formularioVazio();
		f.enunciado = 'Q';
		f.alternativas = ['a', 'b', 'c', 'd', 'sobra'];
		f.correta = 1;
		const v = validarQuestao(entradaDe(f));
		expect(v.ok).toBe(true);
		expect(v.ok && (v.valor.config as { alternativas: string[] }).alternativas).toEqual(['a', 'b', 'c', 'd']);
		const volta = formularioDe({ ...(v.ok ? v.valor : (null as never)), ativa: true });
		expect(volta.formato).toBe('mc4');
		expect(volta.correta).toBe(1);
	});
});

describe('validarSuporte', () => {
	it('exige título e texto ou imagem, e chave de imagem no formato certo', () => {
		expect(validarSuporte({ titulo: 'T', texto: 'x' }).ok).toBe(true);
		expect(validarSuporte({ titulo: '', texto: 'x' }).ok).toBe(false);
		expect(validarSuporte({ titulo: 'T' }).ok).toBe(false);
		expect(validarSuporte({ titulo: 'T', imagem_chave: '../segredo' }).ok).toBe(false);
		expect(validarSuporte({ titulo: 'T', imagem_chave: '3f2b8c1e-aaaa-4bbb-8ccc-123456789abc.png' }).ok).toBe(true);
	});
});
