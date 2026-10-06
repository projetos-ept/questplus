import { describe, expect, it } from 'vitest';
import { deInputLocal, paraInputLocal } from './data';
import {
	embaralhar, estadoAtividade, expirou, feedbackDoModo, gerarCodigo, montarSnapshot, prazoDaTentativa, validarAtividade, validarInicio, validarTurma, versaoAluno
} from './atividade';

const T = (s: string) => Date.parse(s);

describe('estadoAtividade', () => {
	const base = { ativa: true, abre_em: '2026-10-10T12:00:00.000Z', fecha_em: '2026-10-20T12:00:00.000Z' };
	it('segue a tabela da documentação', () => {
		expect(estadoAtividade(base, T('2026-10-09T00:00:00Z'))).toBe('antes');
		expect(estadoAtividade(base, T('2026-10-15T00:00:00Z'))).toBe('no_prazo');
		expect(estadoAtividade(base, T('2026-10-21T00:00:00Z'))).toBe('encerrada');
		expect(estadoAtividade({ ...base, ativa: false }, T('2026-10-15T00:00:00Z'))).toBe('inativa');
		expect(estadoAtividade({ ativa: true, abre_em: null, fecha_em: null })).toBe('no_prazo');
	});
});

describe('prazo da tentativa', () => {
	it('é o menor entre início + tempo e o fim do prazo', () => {
		const inicio = T('2026-10-15T10:00:00Z');
		expect(prazoDaTentativa(inicio, 3600, '2026-10-15T10:30:00Z')).toBe('2026-10-15T10:30:00.000Z');
		expect(prazoDaTentativa(inicio, 1800, '2026-10-15T12:00:00Z')).toBe('2026-10-15T10:30:00.000Z');
		expect(prazoDaTentativa(inicio, null, null)).toBeNull();
		expect(prazoDaTentativa(inicio, null, '2026-10-15T12:00:00Z')).toBe('2026-10-15T12:00:00.000Z');
	});
	it('aceita 5 s de tolerância e o acréscimo de tempo', () => {
		const prazo = '2026-10-15T10:00:00.000Z';
		expect(expirou(prazo, 0, T(prazo) + 4000)).toBe(false);
		expect(expirou(prazo, 0, T(prazo) + 6000)).toBe(true);
		expect(expirou(prazo, 600, T(prazo) + 300_000)).toBe(false);
		expect(expirou(null, 0, Date.now() + 1e12)).toBe(false);
	});
});

describe('snapshot', () => {
	const q = { id: 7, tipo: 'mc', enunciado: 'Q', config: { alternativas: ['a', 'b', 'c', 'd'], correta: 1 }, explicacao: 'porque', pontos: 2, suporte: null };
	it('embaralhar mantém todos os itens e remapeia a correta', () => {
		for (let n = 0; n < 50; n++) {
			const s = montarSnapshot(q, true);
			const c = s.config as { alternativas: string[]; correta: number };
			expect([...c.alternativas].sort()).toEqual(['a', 'b', 'c', 'd']);
			expect(c.alternativas[c.correta]).toBe('b');
		}
	});
	it('sem embaralhar não muda nada', () => {
		expect(montarSnapshot(q, false).config).toEqual(q.config);
	});
	it('a versão do aluno nunca leva gabarito nem explicação', () => {
		const mc = JSON.stringify(versaoAluno(montarSnapshot(q, false)));
		expect(mc).not.toContain('correta');
		expect(mc).not.toContain('porque');
		const vf = montarSnapshot({ ...q, tipo: 'vf', config: { afirmacoes: [{ texto: 'x', valor: true }] } }, false);
		expect(JSON.stringify(versaoAluno(vf))).not.toContain('valor');
	});
	it('embaralhar com gerador fixo é determinístico', () => {
		expect(embaralhar([1, 2, 3, 4], () => 0)).toEqual([2, 3, 4, 1]);
	});
});

describe('validarAtividade', () => {
	const ok = { titulo: 'T', questoes: [{ questao_id: 1 }, { questao_id: 2, pontos: 3 }], turmas: [1] };
	it('aceita o mínimo e normaliza datas', () => {
		const r = validarAtividade({ ...ok, fecha_em: '2026-10-20T15:00:00-03:00' });
		expect(r.ok && r.valor.fecha_em).toBe('2026-10-20T18:00:00.000Z');
		expect(r.ok && r.valor.questoes[0].pontos).toBeNull();
		expect(r.ok && r.valor.ativa).toBe(true);
	});
	it('recusa o que está errado', () => {
		expect(validarAtividade({ ...ok, titulo: '' }).ok).toBe(false);
		expect(validarAtividade({ ...ok, questoes: [] }).ok).toBe(false);
		expect(validarAtividade({ ...ok, questoes: [{ questao_id: 1 }, { questao_id: 1 }] }).ok).toBe(false);
		expect(validarAtividade({ ...ok, turmas: [] }).ok).toBe(false);
		expect(validarAtividade({ ...ok, codigo: 'a b' }).ok).toBe(false);
		expect(validarAtividade({ ...ok, codigo: 'Admin' }).ok).toBe(false);
		expect(validarAtividade({ ...ok, codigo: 'prova-parasito-2026' }).ok).toBe(true);
		expect(validarAtividade({ ...ok, modo: 'ao_vivo' }).ok).toBe(false);
		expect(validarAtividade({ ...ok, modo: 'xyz' }).ok).toBe(false);
		expect(validarAtividade({ ...ok, abre_em: '2026-10-20T10:00:00Z', fecha_em: '2026-10-19T10:00:00Z' }).ok).toBe(false);
		expect(validarAtividade({ ...ok, fecha_em: 'ontem' }).ok).toBe(false);
	});
	it('gera códigos legíveis', () => {
		for (let i = 0; i < 100; i++) expect(gerarCodigo()).toMatch(/^[A-HJKMNP-Z2-9]{6}$/);
	});
});

describe('modo Prova', () => {
	const base = { titulo: 'P', questoes: [{ questao_id: 1 }], turmas: [1] };
	it('Treino: sem limites por padrão', () => {
		const r = validarAtividade(base);
		expect(r.ok && r.valor).toMatchObject({ modo: 'treino', tempo_total: null, tentativas_max: null, navegacao: 'livre', mostra_nota: false });
	});
	it('Prova: uma tentativa por padrão, tempo em minutos vira segundos', () => {
		const r = validarAtividade({ ...base, modo: 'prova', tempo_total_min: 45 });
		expect(r.ok && r.valor).toMatchObject({ modo: 'prova', tempo_total: 2700, tentativas_max: 1 });
	});
	it('número de tentativas: informado, ilimitado (null) e inválido', () => {
		const p = { ...base, modo: 'prova' };
		expect(validarAtividade({ ...p, tentativas_max: 3 })).toMatchObject({ ok: true, valor: { tentativas_max: 3 } });
		expect(validarAtividade({ ...p, tentativas_max: null })).toMatchObject({ ok: true, valor: { tentativas_max: null } });
		expect(validarAtividade({ ...p, tentativas_max: '' })).toMatchObject({ ok: true, valor: { tentativas_max: null } });
		expect(validarAtividade({ ...p, tentativas_max: 0 }).ok).toBe(false);
		expect(validarAtividade({ ...p, tentativas_max: 2.5 }).ok).toBe(false);
		expect(validarAtividade({ ...p, tentativas_max: 100 }).ok).toBe(false);
	});
	it('tempo inválido e navegação inválida', () => {
		expect(validarAtividade({ ...base, tempo_total_min: 0 }).ok).toBe(false);
		expect(validarAtividade({ ...base, tempo_total_min: 601 }).ok).toBe(false);
		expect(validarAtividade({ ...base, tempo_total_min: 1.5 }).ok).toBe(false);
		expect(validarAtividade({ ...base, navegacao: 'aleatoria' }).ok).toBe(false);
	});
	it('mostrar a nota só vale na Prova', () => {
		expect(validarAtividade({ ...base, modo: 'prova', mostra_nota: true })).toMatchObject({ ok: true, valor: { mostra_nota: true } });
		expect(validarAtividade({ ...base, modo: 'treino', mostra_nota: true })).toMatchObject({ ok: true, valor: { mostra_nota: false } });
	});
	it('o modo define o feedback: Treino mostra o gabarito, Prova nunca', () => {
		expect(feedbackDoModo('treino')).toBe('imediato');
		expect(feedbackDoModo('prova')).toBe('nenhum');
	});
});

describe('turma e início da tentativa', () => {
	it('valida turma', () => {
		expect(validarTurma({ nome: ' 2º A ' }).ok).toBe(true);
		expect(validarTurma({ nome: '' }).ok).toBe(false);
	});
	it('valida os dados do aluno', () => {
		expect(validarInicio({ codigo: 'ABC123', nome: ' Ana  Maria ', turma_id: 2, email: 'a@b.co' })).toMatchObject({ ok: true, valor: { nome: 'Ana Maria' } });
		expect(validarInicio({ codigo: 'ABC123', nome: 'A', turma_id: 2, email: 'a@b.co' }).ok).toBe(false);
		expect(validarInicio({ codigo: 'ABC123', nome: 'Ana', turma_id: 0, email: 'a@b.co' }).ok).toBe(false);
		expect(validarInicio({ codigo: 'ABC123', nome: 'Ana', turma_id: 1, email: 'sem-arroba' }).ok).toBe(false);
	});
});

describe('datas locais', () => {
	it('ida e volta mantém o instante (ao minuto)', () => {
		const iso = '2026-10-20T18:30:00.000Z';
		expect(deInputLocal(paraInputLocal(iso))).toBe(iso);
		expect(paraInputLocal(null)).toBe('');
		expect(deInputLocal('')).toBeNull();
	});
});
