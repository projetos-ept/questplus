import { describe, expect, it } from 'vitest';
import { aproveitamentoPorQuestao, celulaCsv, consolidar, formatarTempo, montarCsv, nomesComEmailsDiferentes, percentualDe, resumir, tempoGasto, type TentativaResumo } from './relatorio';

let n = 0;
const t = (nome: string, email: string, nota: number | null, extra: Partial<TentativaResumo> = {}): TentativaResumo => ({
	id: ++n, nome, email, turma: 'A', status: 'finalizada', anulada: 0, inicio_em: '2026-10-06T10:00:00.000Z', finalizada_em: `2026-10-06T10:${String(n).padStart(2, '0')}:00.000Z`, nota, pontos_max: 10, ...extra
});

describe('percentual e tempo', () => {
	it('percentual com 1 casa e proteção contra máximo zero', () => {
		expect(percentualDe(7, 10)).toBe(70);
		expect(percentualDe(1, 3)).toBe(33.3);
		expect(percentualDe(5, 0)).toBe(0);
		expect(percentualDe(null, 10)).toBe(0);
	});
	it('tempo gasto e formato', () => {
		expect(tempoGasto({ inicio_em: '2026-10-06T10:00:00Z', finalizada_em: '2026-10-06T10:12:30Z' })).toBe(750);
		expect(tempoGasto({ inicio_em: '2026-10-06T10:00:00Z', finalizada_em: null })).toBeNull();
		expect(formatarTempo(750)).toBe('12min 30s');
		expect(formatarTempo(45)).toBe('45s');
		expect(formatarTempo(3900)).toBe('1h 05min');
		expect(formatarTempo(null)).toBe('—');
	});
});

describe('consolidar: vale a maior nota de cada aluno', () => {
	it('escolhe a melhor tentativa por e-mail (sem diferenciar caixa) e conta as válidas', () => {
		const lista = [t('Ana', 'ana@x.com', 4), t('Ana S.', 'ANA@x.com', 8), t('Ana', 'ana@x.com', 6), t('Bia', 'bia@x.com', 5)];
		const r = consolidar(lista);
		expect(r.map((a) => [a.nome, a.melhor.nota, a.tentativas, a.percentual])).toEqual([['Ana S.', 8, 3, 80], ['Bia', 5, 1, 50]]);
	});
	it('ignora anuladas e em andamento', () => {
		const r = consolidar([t('Ana', 'a@x.com', 9, { anulada: 1 }), t('Ana', 'a@x.com', 3), t('Ana', 'a@x.com', 10, { status: 'andamento', finalizada_em: null }), t('Zé', 'z@x.com', null, { status: 'andamento' })]);
		expect(r).toHaveLength(1);
		expect(r[0].melhor.nota).toBe(3);
		expect(r[0].tentativas).toBe(1);
	});
	it('empate fica com a que terminou primeiro', () => {
		const a = t('Ana', 'a@x.com', 7, { finalizada_em: '2026-10-06T11:00:00Z' });
		const b = t('Ana', 'a@x.com', 7, { finalizada_em: '2026-10-06T10:30:00Z' });
		expect(consolidar([a, b])[0].melhor.id).toBe(b.id);
	});
	it('compara por porcentagem, não por pontos brutos (prova editada no meio)', () => {
		const r = consolidar([t('Ana', 'a@x.com', 8, { pontos_max: 20 }), t('Ana', 'a@x.com', 5, { pontos_max: 8 })]);
		expect(r[0].melhor.nota).toBe(5);
	});
	it('ordena por nome com acentos', () => {
		const r = consolidar([t('Érica', 'e@x.com', 1), t('Ana', 'a@x.com', 1), t('Zélia', 'z@x.com', 1)]);
		expect(r.map((a) => a.nome)).toEqual(['Ana', 'Érica', 'Zélia']);
	});
});

describe('resumir', () => {
	it('média, mediana, extremos, contadores e faixas', () => {
		const lista = [t('A', 'a@x', 10), t('B', 'b@x', 8), t('C', 'c@x', 5), t('D', 'd@x', 2), t('A', 'a@x', 1, { anulada: 1 }), t('E', 'e@x', null, { status: 'andamento' })];
		const r = resumir(lista, consolidar(lista));
		expect(r).toMatchObject({ alunos: 4, tentativas: 4, anuladas: 1, emAndamento: 1, mediaPontos: 6.3, mediaPercentual: 62.5, medianaPercentual: 65, maiorPercentual: 100, menorPercentual: 20 });
		expect(r.distribuicao.map((d) => d.alunos)).toEqual([0, 1, 1, 0, 2]);
	});
	it('sem alunos não inventa números', () => {
		expect(resumir([], [])).toMatchObject({ alunos: 0, mediaPontos: null, mediaPercentual: null, medianaPercentual: null, maiorPercentual: null });
	});
	it('mediana com quantidade ímpar', () => {
		const lista = [t('A', 'a@x', 1), t('B', 'b@x', 5), t('C', 'c@x', 9)];
		expect(resumir(lista, consolidar(lista)).medianaPercentual).toBe(50);
	});
});

describe('aproveitamento por questão', () => {
	const q = (id: number, pontos = 2) => ({ id, tipo: 'mc', enunciado: `Q${id}`, pontos });
	it('soma pontos obtidos sobre possíveis e separa em branco', () => {
		const r = aproveitamentoPorQuestao([
			{ questoes: [q(1), q(2)], pontosPorQuestao: new Map([[1, 2], [2, 0]]) },
			{ questoes: [q(1), q(2)], pontosPorQuestao: new Map([[1, 0]]) }
		]);
		expect(r.find((x) => x.id === 1)).toMatchObject({ alunos: 2, respondida: 2, emBranco: 0, aproveitamento: 50 });
		expect(r.find((x) => x.id === 2)).toMatchObject({ alunos: 2, respondida: 1, emBranco: 1, aproveitamento: 0 });
	});
	it('questões que só algumas provas tinham contam só para quem as tinha', () => {
		const r = aproveitamentoPorQuestao([{ questoes: [q(1)], pontosPorQuestao: new Map([[1, 2]]) }, { questoes: [q(1), q(9)], pontosPorQuestao: new Map([[1, 2], [9, 1]]) }]);
		expect(r.find((x) => x.id === 9)).toMatchObject({ alunos: 1, aproveitamento: 50 });
	});
});

describe('CSV', () => {
	it('protege contra fórmulas em planilhas', () => {
		expect(celulaCsv('=HYPERLINK("http://x")')).toBe(`"'=HYPERLINK(""http://x"")"`);
		expect(celulaCsv('+1+1')).toBe("'+1+1");
		expect(celulaCsv('-2')).toBe("'-2");
		expect(celulaCsv('@SUM(A1)')).toBe("'@SUM(A1)");
		expect(celulaCsv('\t=1')).toBe("'\t=1");
	});
	it('não mexe em texto normal; protege ; aspas e quebra de linha', () => {
		expect(celulaCsv('Ana Souza')).toBe('Ana Souza');
		expect(celulaCsv('a;b')).toBe('"a;b"');
		expect(celulaCsv('diz "oi"')).toBe('"diz ""oi"""');
		expect(celulaCsv('linha1\nlinha2')).toBe('"linha1\nlinha2"');
		expect(celulaCsv(null)).toBe('');
		expect(celulaCsv('')).toBe('');
	});
	it('número usa vírgula decimal (Excel em português)', () => {
		expect(celulaCsv(7.5)).toBe('7,5');
		expect(celulaCsv(10)).toBe('10');
	});
	it('começa com BOM, usa ; e CRLF', () => {
		const csv = montarCsv([['Aluno', 'Nota'], ['Ana', 8.5]]);
		expect(csv.startsWith('﻿')).toBe(true);
		expect(csv).toBe('﻿Aluno;Nota\r\nAna;8,5\r\n');
	});
});

describe('mesmo nome, e-mails diferentes', () => {
	const a = (nome: string, email: string, turma = 'A') => ({ nome, email, turma });
	it('aponta nomes iguais ignorando acento, caixa e espaços', () => {
		const r = nomesComEmailsDiferentes([a('José da Silva', 'jose@x.com'), a('  jose  DA silva', 'jose2@x.com', 'B'), a('Ana', 'ana@x.com')]);
		expect(r).toHaveLength(1);
		expect(r[0]).toMatchObject({ emails: ['jose2@x.com', 'jose@x.com'], turmas: ['A', 'B'] });
	});
	it('não aponta o mesmo e-mail com outra caixa nem nomes diferentes', () => {
		expect(nomesComEmailsDiferentes([a('Ana', 'ana@x.com'), a('Ana', 'ANA@x.com')])).toEqual([]);
		expect(nomesComEmailsDiferentes([a('Ana Lima', 'a@x.com'), a('Ana Souza', 'b@x.com')])).toEqual([]);
		expect(nomesComEmailsDiferentes([])).toEqual([]);
	});
});
