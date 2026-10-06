import { describe, expect, it } from 'vitest';
import { chaveDuplicada, lerArquivo, montarExportacao, montarPromptIA, normalizarQuestao, OPCOES_PROMPT_PADRAO } from './importacao';

const mc = { tipo: 'mc', enunciado: 'Vetor?', alternativas: ['Aedes', 'Anopheles', 'Culex', 'Lutzomyia'], correta: 1 };

describe('lerArquivo', () => {
	it('lê o arquivo completo, lista solta e questão solta', () => {
		expect(lerArquivo(JSON.stringify({ formato: 'questplus-questoes', questoes: [mc] }))).toMatchObject({ ok: true, valor: { questoes: [mc] } });
		expect(lerArquivo(JSON.stringify([mc, mc]))).toMatchObject({ ok: true, valor: { questoes: [mc, mc] } });
		expect(lerArquivo(JSON.stringify(mc))).toMatchObject({ ok: true, valor: { questoes: [mc] } });
	});
	it('tolera cerca de código, frase antes/depois e BOM', () => {
		expect(lerArquivo('```json\n' + JSON.stringify([mc]) + '\n```').ok).toBe(true);
		expect(lerArquivo('Claro! Aqui está:\n' + JSON.stringify({ questoes: [mc] }) + '\nEspero que ajude.').ok).toBe(true);
		expect(lerArquivo('﻿' + JSON.stringify([mc])).ok).toBe(true);
	});
	it('recusa vazio, lixo e arquivos sem questões ou grandes demais', () => {
		expect(lerArquivo('').ok).toBe(false);
		expect(lerArquivo('isto não é json').ok).toBe(false);
		expect(lerArquivo('{"a":1}').ok).toBe(false);
		expect(lerArquivo('[]').ok).toBe(false);
		expect(lerArquivo(JSON.stringify(Array(1001).fill(mc))).ok).toBe(false);
	});
	it('valida os textos de apoio (ref obrigatória e única, título e texto)', () => {
		const q = [mc];
		expect(lerArquivo(JSON.stringify({ suportes: [{ ref: 's1', titulo: 'T', texto: 'x' }], questoes: q }))).toMatchObject({ ok: true, valor: { suportes: [{ ref: 's1', titulo: 'T' }] } });
		expect(lerArquivo(JSON.stringify({ suportes: [{ titulo: 'T', texto: 'x' }], questoes: q })).ok).toBe(false);
		expect(lerArquivo(JSON.stringify({ suportes: [{ ref: 's1', titulo: 'T', texto: 'x' }, { ref: 's1', titulo: 'U', texto: 'y' }], questoes: q })).ok).toBe(false);
		expect(lerArquivo(JSON.stringify({ suportes: [{ ref: 's1', titulo: '', texto: 'x' }], questoes: q })).ok).toBe(false);
	});
});

describe('normalizarQuestao', () => {
	it('aceita o formato do prompt (alternativas e correta no topo)', () => {
		const r = normalizarQuestao(mc);
		expect(r).toMatchObject({ ok: true, valor: { tipo: 'mc', config: { alternativas: ['Aedes', 'Anopheles', 'Culex', 'Lutzomyia'], correta: 1 }, suporte_ref: null } });
	});
	it('aceita o formato exportado (config explícito)', () => {
		const r = normalizarQuestao({ tipo: 'mc', enunciado: 'Q', config: { alternativas: ['a', 'b', 'c', 'd'], correta: 3 }, suporte: 's2' });
		expect(r).toMatchObject({ ok: true, valor: { config: { correta: 3 }, suporte_ref: 's2' } });
	});
	it('tira letras do começo das alternativas (só se todas tiverem)', () => {
		const com = normalizarQuestao({ ...mc, alternativas: ['A) Aedes', 'B) Anopheles', 'C) Culex', 'D) Lutzomyia'] });
		expect(com.ok && (com.valor.config as { alternativas: string[] }).alternativas).toEqual(['Aedes', 'Anopheles', 'Culex', 'Lutzomyia']);
		const mista = normalizarQuestao({ ...mc, alternativas: ['A) Aedes', 'Anopheles', 'Culex', 'Lutzomyia'] });
		expect(mista.ok && (mista.valor.config as { alternativas: string[] }).alternativas[0]).toBe('A) Aedes');
		const ponto = normalizarQuestao({ ...mc, alternativas: ['a. um', 'b. dois', 'c. três', 'd. quatro'] });
		expect(ponto.ok && (ponto.valor.config as { alternativas: string[] }).alternativas[1]).toBe('dois');
	});
	it('aceita a correta como letra, número em texto e rótulos de tipo', () => {
		expect(normalizarQuestao({ ...mc, correta: 'C' })).toMatchObject({ ok: true, valor: { config: { correta: 2 } } });
		expect(normalizarQuestao({ ...mc, correta: 'b' })).toMatchObject({ ok: true, valor: { config: { correta: 1 } } });
		expect(normalizarQuestao({ ...mc, correta: '3' })).toMatchObject({ ok: true, valor: { config: { correta: 3 } } });
		expect(normalizarQuestao({ ...mc, tipo: 'MC4' }).ok).toBe(true);
		expect(normalizarQuestao({ ...mc, tipo: 'Múltipla Escolha' }).ok).toBe(true);
	});
	it('recusa gabarito fora do intervalo ou ausente, e número errado de alternativas', () => {
		expect(normalizarQuestao({ ...mc, correta: 4 }).ok).toBe(false);
		expect(normalizarQuestao({ ...mc, correta: undefined }).ok).toBe(false);
		expect(normalizarQuestao({ ...mc, correta: 'Z' }).ok).toBe(false);
		expect(normalizarQuestao({ ...mc, alternativas: ['a', 'b', 'c'] }).ok).toBe(false);
	});
	it('VF: aceita boolean e texto (V/F, verdadeiro/falso, certo/errado)', () => {
		const vf = { tipo: 'VF', enunciado: 'Julgue', afirmacoes: [{ texto: 'a', valor: 'Verdadeiro' }, { texto: 'b', valor: 'F' }, { texto: 'c', valor: false }, { texto: 'd', valor: 'Certo' }, { texto: 'e', valor: 'errado' }] };
		const r = normalizarQuestao(vf);
		expect(r.ok && (r.valor.config as { afirmacoes: { valor: boolean }[] }).afirmacoes.map((a) => a.valor)).toEqual([true, false, false, true, false]);
		expect(normalizarQuestao({ ...vf, afirmacoes: [{ texto: 'a', valor: 'talvez' }] }).ok).toBe(false);
	});
	it('deduz o tipo quando ele falta', () => {
		expect(normalizarQuestao({ enunciado: 'Q', afirmacoes: [{ texto: 'a', valor: true }] })).toMatchObject({ ok: true, valor: { tipo: 'vf' } });
		const { tipo: _t, ...semTipo } = mc;
		expect(normalizarQuestao(semTipo)).toMatchObject({ ok: true, valor: { tipo: 'mc' } });
	});
	it('etiquetas em lista ou texto, pontos e ativa com padrão', () => {
		const r = normalizarQuestao({ ...mc, etiquetas: 'Malária, parasitologia', pontos: '2' });
		expect(r).toMatchObject({ ok: true, valor: { etiquetas: ['malária', 'parasitologia'], pontos: 2, ativa: true } });
		expect(normalizarQuestao({ ...mc, enunciado: '' }).ok).toBe(false);
		expect(normalizarQuestao(null).ok).toBe(false);
		expect(normalizarQuestao({ ...mc, tipo: 'aberta' }).ok).toBe(false);
	});
});

describe('duplicadas', () => {
	it('ignora caixa, acentos e espaços; separa por formato', () => {
		expect(chaveDuplicada('mc', '  Qual o VETOR   da malária? ')).toBe(chaveDuplicada('mc', 'qual o vetor da malaria?'));
		expect(chaveDuplicada('mc', 'x')).not.toBe(chaveDuplicada('vf', 'x'));
	});
});

describe('exportar e reimportar', () => {
	it('o arquivo exportado é lido de volta sem perda', () => {
		const exp = montarExportacao(
			[
				{ tipo: 'mc', enunciado: 'Q1', config: { alternativas: ['a', 'b', 'c', 'd', 'e'], correta: 4 }, explicacao: 'porque', pontos: 2, suporte_id: 7, etiquetas: ['x'], ativa: false },
				{ tipo: 'vf', enunciado: 'Q2', config: { afirmacoes: [{ texto: 'a', valor: true }] }, explicacao: null, pontos: 1, suporte_id: null, etiquetas: [], ativa: true }
			],
			[{ id: 7, titulo: 'Apoio', texto: 'Texto', imagem_chave: null }]
		);
		const lido = lerArquivo(JSON.stringify(exp));
		expect(lido.ok && lido.valor.suportes).toEqual([{ ref: 's7', titulo: 'Apoio', texto: 'Texto', imagem_chave: null }]);
		const q = lido.ok ? lido.valor.questoes.map(normalizarQuestao) : [];
		expect(q[0]).toMatchObject({ ok: true, valor: { tipo: 'mc', pontos: 2, ativa: false, suporte_ref: 's7', explicacao: 'porque', config: { correta: 4 } } });
		expect(q[1]).toMatchObject({ ok: true, valor: { tipo: 'vf', suporte_ref: null, explicacao: null } });
	});
});

describe('instrução para IA', () => {
	it('inclui tema, quantidade, nível, formatos e etiquetas', () => {
		const p = montarPromptIA({ ...OPCOES_PROMPT_PADRAO, tema: 'Ciclo da malária', quantidade: 7, nivel: 'difícil', formatos: { mc4: false, mc5: true, vf: true }, etiquetas: 'Malária, Parasitologia', comApoio: true });
		expect(p).toContain('7 questões');
		expect(p).toContain('Ciclo da malária');
		expect(p).toContain('NÍVEL DE DIFICULDADE: difícil');
		expect(p).toContain('múltipla escolha com 5 alternativas, verdadeiro ou falso');
		expect(p).not.toContain('com 4 alternativas');
		expect(p).toContain('malária, parasitologia');
		expect(p).toContain('TEXTO DE APOIO');
		expect(p).toContain('questplus-questoes');
	});
	it('o exemplo do próprio prompt é um JSON que a importação aceita', () => {
		const bloco = montarPromptIA(OPCOES_PROMPT_PADRAO).match(/\{\n {2}"formato"[\s\S]*?\n\}\n/)![0];
		const lido = lerArquivo(bloco);
		expect(lido.ok && lido.valor.questoes.map((q) => normalizarQuestao(q).ok)).toEqual([true, true]);
	});
});
