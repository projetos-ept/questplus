import { describe, expect, it } from 'vitest';
import { FORMATO_SUPORTES, chaveSuporte, lerArquivoSuportes, montarExportacaoSuportes, montarPromptSuporteIA, normalizarSuporte, OPCOES_PROMPT_SUPORTE_PADRAO } from './importacao-suportes';
import { validarSuporte } from './questao';

const um = { titulo: 'Caso de hemólise', texto: 'Texto **base**.', etiquetas: ['hematologia', 'coleta'] };

describe('ler o arquivo de textos de apoio', () => {
	it('aceita o arquivo completo, uma lista e um texto solto', () => {
		expect(lerArquivoSuportes(JSON.stringify({ formato: FORMATO_SUPORTES, suportes: [um, um] }))).toMatchObject({ ok: true, valor: { suportes: [um, um] } });
		expect(lerArquivoSuportes(JSON.stringify([um]))).toMatchObject({ ok: true });
		expect(lerArquivoSuportes(JSON.stringify(um))).toMatchObject({ ok: true, valor: { suportes: [um] } });
	});
	it('aceita cerca de código e conversa em volta', () => {
		expect(lerArquivoSuportes('Aqui está:\n```json\n' + JSON.stringify({ suportes: [um] }) + '\n```').ok).toBe(true);
	});
	it('recusa vazio, lixo e arquivo de questões', () => {
		expect(lerArquivoSuportes('').ok).toBe(false);
		expect(lerArquivoSuportes('não é json').ok).toBe(false);
		expect(lerArquivoSuportes(JSON.stringify({ suportes: [] })).ok).toBe(false);
		expect(lerArquivoSuportes(JSON.stringify({ questoes: [{ enunciado: 'x' }] })).ok).toBe(false);
	});
});

describe('normalizar um texto de apoio', () => {
	it('lê etiquetas como lista, como texto ou como disciplina', () => {
		expect(normalizarSuporte(um)).toMatchObject({ ok: true, valor: { etiquetas: ['hematologia', 'coleta'] } });
		expect(normalizarSuporte({ ...um, etiquetas: 'Hematologia, Coleta' })).toMatchObject({ ok: true, valor: { etiquetas: ['hematologia', 'coleta'] } });
		expect(normalizarSuporte({ titulo: 'T', texto: 'x', disciplina: 'microbiologia' })).toMatchObject({ ok: true, valor: { etiquetas: ['microbiologia'] } });
		expect(normalizarSuporte({ titulo: 'T', conteudo: 'no lugar de texto' })).toMatchObject({ ok: true, valor: { texto: 'no lugar de texto' } });
	});
	it('recusa título ou texto ausentes e etiqueta demais', () => {
		expect(normalizarSuporte({ titulo: '', texto: 'x' }).ok).toBe(false);
		expect(normalizarSuporte({ titulo: 'T' }).ok).toBe(false);
		expect(normalizarSuporte({ ...um, etiquetas: Array.from({ length: 11 }, (_, i) => `e${i}`) }).ok).toBe(false);
	});
	it('a observação [img] vira tinha_imagem', () => {
		expect(normalizarSuporte({ ...um, observacao: '[img] tinha imagem' })).toMatchObject({ valor: { tinha_imagem: true } });
		expect(normalizarSuporte(um)).toMatchObject({ valor: { tinha_imagem: false } });
	});
	it('chave de repetidos ignora espaços a mais', () => {
		expect(chaveSuporte(' A  B ', 'x\n y')).toBe(chaveSuporte('A B', 'x y'));
	});
});

describe('exportar textos de apoio', () => {
	it('ida e volta mantém título, texto e etiquetas', () => {
		const s = validarSuporte(um);
		if (!s.ok) throw new Error('x');
		const exp = montarExportacaoSuportes([s.valor]);
		expect(exp.formato).toBe(FORMATO_SUPORTES);
		const lido = lerArquivoSuportes(JSON.stringify(exp));
		expect(lido.ok && normalizarSuporte(lido.valor.suportes[0])).toMatchObject({ ok: true, valor: { titulo: um.titulo, texto: 'Texto **base**.', etiquetas: um.etiquetas } });
	});
	it('com imagens, leva a observação [img]', () => {
		const img = { n: 1, chave: '123e4567-e89b-12d3-a456-426614174000.png', legenda: '', tamanho: 'media' as const, largura: null, origem: null };
		const exp = montarExportacaoSuportes([{ ...um, imagens: [img] }]);
		expect((exp.suportes[0] as { observacao?: string }).observacao).toMatch(/^\[img\]/);
	});
});

describe('instrução para IA (textos de apoio)', () => {
	it('traz formato, disciplina obrigatória e regras', () => {
		const p = montarPromptSuporteIA({ ...OPCOES_PROMPT_SUPORTE_PADRAO, tema: 'Coleta de sangue', quantidade: 4, tamanho: 'longo', etiquetas: 'Coleta, Tubos' });
		expect(p).toContain('4 texto(s) de apoio');
		expect(p).toContain('Coleta de sangue');
		expect(p).toContain('cerca de 2500 caracteres');
		expect(p).toContain('coleta, tubos');
		expect(p).toContain(FORMATO_SUPORTES);
		expect(p).toContain('PRIMEIRA etiqueta é OBRIGATORIAMENTE a disciplina do curso técnico em Análises Clínicas');
		expect(p).toContain('hematologia');
		expect(p).toContain('Escolha a que melhor combina');
	});
	it('com disciplina escolhida, fixa a mesma em todos', () => {
		const p = montarPromptSuporteIA({ ...OPCOES_PROMPT_SUPORTE_PADRAO, disciplina: 'uroanalise' });
		expect(p).toContain('exatamente "uroanalise"');
		expect(p).not.toContain('Escolha a que melhor combina');
	});
	it('Mermaid: instruções só quando marcado, com limites e sintaxe', () => {
		const com = montarPromptSuporteIA(OPCOES_PROMPT_SUPORTE_PADRAO);
		expect(com).toContain('```mermaid');
		expect(com).toContain('flowchart TD');
		expect(com).toContain('no máximo 3 por texto e 3000 caracteres');
		expect(montarPromptSuporteIA({ ...OPCOES_PROMPT_SUPORTE_PADRAO, comDiagrama: false })).not.toContain('mermaid');
	});
	it('o exemplo do prompt é um JSON que a importação aceita', () => {
		const bloco = montarPromptSuporteIA(OPCOES_PROMPT_SUPORTE_PADRAO).match(/\{\n {2}"formato"[\s\S]*?\n\}\n/)![0];
		const lido = lerArquivoSuportes(bloco);
		expect(lido.ok && lido.valor.suportes.map((s) => normalizarSuporte(s).ok)).toEqual([true]);
	});
	it('o exemplo de diagrama do prompt vira um bloco que o texto de apoio desenha', async () => {
		const { renderSuporte } = await import('./suporte');
		const p = montarPromptSuporteIA(OPCOES_PROMPT_SUPORTE_PADRAO);
		const ex = /"…parágrafo antes[\s\S]*?parágrafo depois\."/.exec(p)![0];
		const texto = JSON.parse(ex) as string;
		expect(renderSuporte(texto, []).diagramas).toBe(1);
		expect(validarSuporte({ titulo: 'T', texto }).ok).toBe(true);
	});
});
