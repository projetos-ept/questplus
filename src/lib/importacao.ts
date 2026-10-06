import { DISCIPLINAS } from './disciplinas';
import { validarQuestao, validarSuporte, type QuestaoValida, type Resultado, type Suporte } from './questao';

export const FORMATO_ARQUIVO = 'questplus-questoes';
export const VERSAO_ARQUIVO = 1;
export const MAX_QUESTOES_POR_ARQUIVO = 1000;
/** Tamanho do bloco enviado por requisição (limites do plano gratuito: CPU e consultas por invocação). */
export const TAMANHO_BLOCO = 40;

export type SuporteImportado = Suporte & { ref: string };
export type QuestaoNormalizada = QuestaoValida & { suporte_ref: string | null };

// ---------- ler o arquivo (ou o texto colado) ----------

/** Aceita o arquivo completo, uma lista de questões, uma questão solta, e texto com cerca de código markdown ou frase antes/depois. */
export function lerArquivo(texto: string): Resultado<{ suportes: SuporteImportado[]; questoes: unknown[] }> {
	let t = texto.replace(/^﻿/, '').trim();
	if (!t) return { ok: false, erros: ['Cole o JSON ou escolha um arquivo.'] };
	const cerca = /^```[a-z]*\s*([\s\S]*?)\s*```$/i.exec(t);
	if (cerca) t = cerca[1];

	let dados: unknown;
	try {
		dados = JSON.parse(t);
	} catch {
		const ini = t.search(/[[{]/);
		const fim = Math.max(t.lastIndexOf('}'), t.lastIndexOf(']'));
		try {
			dados = ini >= 0 && fim > ini ? JSON.parse(t.slice(ini, fim + 1)) : undefined;
		} catch {
			dados = undefined;
		}
		if (dados === undefined) return { ok: false, erros: ['Não consegui ler como JSON. Confira se o texto está completo e sem comentários.'] };
	}

	let bruto: unknown[];
	let suportesBrutos: unknown[] = [];
	if (Array.isArray(dados)) bruto = dados;
	else if (dados && typeof dados === 'object' && Array.isArray((dados as { questoes?: unknown }).questoes)) {
		bruto = (dados as { questoes: unknown[] }).questoes;
		const s = (dados as { suportes?: unknown }).suportes;
		if (Array.isArray(s)) suportesBrutos = s;
	} else if (dados && typeof dados === 'object' && 'enunciado' in dados) bruto = [dados];
	else return { ok: false, erros: ['O JSON precisa ter uma lista "questoes" (ou ser uma lista de questões).'] };

	if (bruto.length === 0) return { ok: false, erros: ['Não há nenhuma questão no arquivo.'] };
	if (bruto.length > MAX_QUESTOES_POR_ARQUIVO) return { ok: false, erros: [`O arquivo tem ${bruto.length} questões; o limite é ${MAX_QUESTOES_POR_ARQUIVO} por importação.`] };

	const erros: string[] = [];
	const suportes: SuporteImportado[] = [];
	const refs = new Set<string>();
	suportesBrutos.forEach((s, i) => {
		const o = (s && typeof s === 'object' ? s : {}) as Record<string, unknown>;
		const ref = typeof o.ref === 'string' || typeof o.ref === 'number' ? String(o.ref).trim() : '';
		if (!ref) return void erros.push(`Texto de apoio ${i + 1}: falta o campo "ref" (um nome curto, como "s1").`);
		if (refs.has(ref)) return void erros.push(`Texto de apoio ${i + 1}: a ref "${ref}" está repetida.`);
		refs.add(ref);
		const v = validarSuporte({ titulo: o.titulo, texto: o.texto, imagens: o.imagens, imagem_chave: o.imagem_chave });
		if (!v.ok) return void erros.push(`Texto de apoio "${ref}": ${v.erros.join(' ')}`);
		suportes.push({ ref, ...v.valor });
	});
	if (erros.length) return { ok: false, erros };
	return { ok: true, valor: { suportes, questoes: bruto } };
}

// ---------- normalizar uma questão (tolerante a variações comuns de IA) ----------

const SEM_ACENTO = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '');

const MAPA_TIPO: Record<string, 'mc' | 'vf' | 'aberta'> = {
	mc: 'mc', mc4: 'mc', mc5: 'mc', multipla_escolha: 'mc', multiplaescolha: 'mc', alternativas: 'mc',
	vf: 'vf', verdadeiro_falso: 'vf', verdadeirofalso: 'vf', certo_errado: 'vf',
	aberta: 'aberta', dissertativa: 'aberta', discursiva: 'aberta'
};

function tipoDe(v: unknown) {
	const k = SEM_ACENTO(String(v ?? '')).toLowerCase().trim().replace(/[\s/-]+/g, '_');
	return MAPA_TIPO[k] ?? v;
}

const PREFIXO_LETRA = /^\s*(?:\(?[A-Ea-e]\)|[A-Ea-e][.):-])\s+/;

function indiceCorreto(v: unknown) {
	if (typeof v === 'number') return v;
	if (typeof v === 'string') {
		const t = v.trim();
		if (/^[A-Ea-e]$/.test(t)) return t.toLowerCase().charCodeAt(0) - 97;
		if (/^\d+$/.test(t)) return Number(t);
	}
	return v;
}

const VERDADEIRO = ['v', 'verdadeiro', 'verdadeira', 'true', 'certo', 'sim'];
const FALSO = ['f', 'falso', 'falsa', 'false', 'errado', 'nao'];

function valorVF(v: unknown) {
	if (typeof v === 'boolean') return v;
	const k = SEM_ACENTO(String(v ?? '')).toLowerCase().trim();
	if (VERDADEIRO.includes(k)) return true;
	if (FALSO.includes(k)) return false;
	return v;
}

export function normalizarQuestao(bruta: unknown): Resultado<QuestaoNormalizada> {
	const o = (bruta && typeof bruta === 'object' ? bruta : {}) as Record<string, unknown>;
	const c = (o.config && typeof o.config === 'object' ? o.config : {}) as Record<string, unknown>;
	const tipo = tipoDe(o.tipo ?? (o.afirmacoes || c.afirmacoes ? 'vf' : 'mc'));

	let config: unknown = {};
	if (tipo === 'mc') {
		let alt = o.alternativas ?? c.alternativas;
		if (Array.isArray(alt)) {
			const textos = alt.map((a) => (typeof a === 'string' ? a : a && typeof a === 'object' ? ((a as { texto?: unknown }).texto ?? a) : a));
			alt = textos.every((a) => typeof a === 'string' && PREFIXO_LETRA.test(a)) ? textos.map((a) => (a as string).replace(PREFIXO_LETRA, '')) : textos;
		}
		config = { alternativas: alt, correta: indiceCorreto(o.correta ?? c.correta) };
	} else if (tipo === 'vf') {
		const af = o.afirmacoes ?? c.afirmacoes;
		config = {
			afirmacoes: Array.isArray(af)
				? af.map((a) => {
						const x = (a && typeof a === 'object' ? a : {}) as Record<string, unknown>;
						return { texto: x.texto, valor: valorVF(x.valor) };
					})
				: af
		};
	} else if (tipo === 'aberta') {
		const conceitos = o.conceitos ?? c.conceitos;
		const oposicoes = o.oposicoes ?? c.oposicoes;
		config = {
			referencia: o.referencia ?? c.referencia ?? o.resposta_referencia,
			conceitos: Array.isArray(conceitos)
				? conceitos.map((x) => {
						if (typeof x === 'string') return { nome: x, sinonimos: [] };
						const k = (x && typeof x === 'object' ? x : {}) as Record<string, unknown>;
						return { nome: k.nome ?? k.conceito, sinonimos: k.sinonimos ?? [] };
					})
				: conceitos,
			oposicoes: Array.isArray(oposicoes) ? oposicoes.map((x) => (Array.isArray(x) ? x : x && typeof x === 'object' ? [(x as Record<string, unknown>).a, (x as Record<string, unknown>).b] : x)) : [],
			min_chars: o.min_chars ?? c.min_chars,
			pontos_por_nivel: o.pontos_por_nivel ?? c.pontos_por_nivel
		};
	}

	const suporteRef = o.suporte === null || o.suporte === undefined || o.suporte === '' ? null : String(o.suporte).trim();
	const r = validarQuestao({
		tipo, enunciado: o.enunciado, config, explicacao: o.explicacao, pontos: o.pontos, etiquetas: o.etiquetas, ativa: o.ativa, suporte_id: null
	});
	return r.ok ? { ok: true, valor: { ...r.valor, suporte_ref: suporteRef } } : r;
}

/** Chave para achar questões repetidas: mesmo formato e enunciado, ignorando caixa, acentos e espaços. */
export const chaveDuplicada = (tipo: string, enunciado: string) =>
	`${tipo}|${SEM_ACENTO(enunciado).toLowerCase().replace(/\s+/g, ' ').trim()}`;

// ---------- exportar ----------

type QuestaoExportavel = Omit<QuestaoValida, 'suporte_id'> & { suporte_id: number | null };
type SuporteExportavel = { id: number; titulo: string; texto: string; imagens: Suporte['imagens'] };

export function montarExportacao(questoes: QuestaoExportavel[], suportes: SuporteExportavel[], quando = new Date()) {
	const refDe = (id: number) => `s${id}`;
	return {
		formato: FORMATO_ARQUIVO,
		versao: VERSAO_ARQUIVO,
		exportado_em: quando.toISOString(),
		suportes: suportes.map((s) => ({ ref: refDe(s.id), titulo: s.titulo, texto: s.texto, imagens: s.imagens })),
		questoes: questoes.map((q) => ({
			tipo: q.tipo,
			enunciado: q.enunciado,
			config: q.config,
			explicacao: q.explicacao,
			pontos: q.pontos,
			etiquetas: q.etiquetas,
			ativa: q.ativa,
			suporte: q.suporte_id === null ? null : refDe(q.suporte_id)
		}))
	};
}

// ---------- instrução para IA ----------

export type OpcoesPrompt = {
	tema: string;
	quantidade: number;
	nivel: string;
	formatos: { mc4: boolean; mc5: boolean; vf: boolean; aberta: boolean };
	etiquetas: string;
	/** Id da disciplina que todas as questões devem ter como primeira etiqueta ('' = a IA escolhe entre as da lista). */
	disciplina: string;
	comApoio: boolean;
};

export const OPCOES_PROMPT_PADRAO: OpcoesPrompt = {
	tema: '[ESCREVA O TEMA OU COLE O CONTEÚDO BASE AQUI]',
	quantidade: 10,
	nivel: 'médio',
	formatos: { mc4: true, mc5: false, vf: true, aberta: false },
	etiquetas: '',
	disciplina: '',
	comApoio: false
};

const ABERTA_REGRAS = `
12. Questão ABERTA (resposta escrita, corrigida por rubrica): use "tipo": "aberta" neste formato, sem "alternativas" nem "afirmacoes":
    {
      "tipo": "aberta",
      "enunciado": "Explique o papel da insulina na regulação da glicemia.",
      "referencia": "Resposta modelo completa, de 2 a 5 frases, com até 1200 caracteres.",
      "conceitos": [
        { "nome": "captação de glicose pelas células", "sinonimos": ["entrada de glicose na célula", "transporte de glicose"] },
        { "nome": "redução da glicemia", "sinonimos": ["diminui o açúcar no sangue"] }
      ],
      "oposicoes": [["aumenta", "reduz"]],
      "min_chars": 30,
      "pontos": 4,
      "etiquetas": ["hematologia", "assunto"]
    }
13. Em "aberta": de 3 a 6 conceitos-chave que uma boa resposta precisa conter, cada um com até 10 sinônimos reais que o aluno poderia usar; "oposicoes" são pares de termos contrários que revelam erro conceitual se trocados (pode ser lista vazia); "min_chars" entre 20 e 80.`;

export function montarPromptIA(o: OpcoesPrompt): string {
	const formatos = [o.formatos.mc4 && 'múltipla escolha com 4 alternativas', o.formatos.mc5 && 'múltipla escolha com 5 alternativas', o.formatos.vf && 'verdadeiro ou falso', o.formatos.aberta && 'aberta (resposta escrita)']
		.filter(Boolean)
		.join(', ');
	const etiquetas = o.etiquetas
		.split(',')
		.map((e) => e.trim().toLowerCase())
		.filter(Boolean);
	return `Você é um elaborador experiente de questões de prova. Crie ${o.quantidade} questões sobre o tema a seguir.

TEMA / CONTEÚDO BASE:
${o.tema.trim() || OPCOES_PROMPT_PADRAO.tema}

NÍVEL DE DIFICULDADE: ${o.nivel}
FORMATOS PERMITIDOS: ${formatos || 'múltipla escolha com 4 alternativas'}${etiquetas.length ? `\nETIQUETAS A USAR EM TODAS AS QUESTÕES: ${etiquetas.join(', ')}` : ''}${o.comApoio ? '\nTEXTO DE APOIO: quando fizer sentido, crie um texto de apoio curto e use-o em mais de uma questão.' : ''}

Responda SOMENTE com um JSON válido, sem nenhum texto antes ou depois e sem bloco de código markdown, exatamente neste formato:

{
  "formato": "${FORMATO_ARQUIVO}",
  "versao": ${VERSAO_ARQUIVO},
  "suportes": [
    { "ref": "s1", "titulo": "Título do texto de apoio", "texto": "Texto de apoio em Markdown simples" }
  ],
  "questoes": [
    {
      "tipo": "mc",
      "enunciado": "Texto da pergunta?",
      "alternativas": ["Primeira", "Segunda", "Terceira", "Quarta"],
      "correta": 1,
      "explicacao": "Por que a alternativa correta está certa.",
      "pontos": 1,
      "etiquetas": ["hematologia", "assunto"],
      "suporte": "s1"
    },
    {
      "tipo": "vf",
      "enunciado": "Julgue os itens a seguir:",
      "afirmacoes": [
        { "texto": "Afirmação verdadeira.", "valor": true },
        { "texto": "Afirmação falsa.", "valor": false }
      ],
      "explicacao": "Comentário sobre o gabarito.",
      "pontos": 2,
      "etiquetas": ["hematologia", "assunto"]
    }
  ]
}

REGRAS OBRIGATÓRIAS:
1. "tipo" é "mc" (múltipla escolha) ou "vf" (verdadeiro ou falso)${o.formatos.aberta ? ' ou "aberta" (resposta escrita, regra 12)' : ''}. Use só os formatos permitidos acima.
2. Em "mc": use 4 ou 5 alternativas; escreva o texto SEM letra ou número no início ("Anopheles", e não "B) Anopheles"); exatamente UMA alternativa correta.
3. "correta" é o ÍNDICE da alternativa certa começando em ZERO: 0 = primeira, 1 = segunda, 2 = terceira, 3 = quarta, 4 = quinta. Varie a posição da correta entre as questões.
4. Em "vf": de 1 a 10 afirmações, cada uma com "valor" true (verdadeira) ou false (falsa). Misture verdadeiras e falsas.
5. "explicacao": de 1 a 3 frases explicando o gabarito.
6. "pontos": número positivo (1 para MC; para VF, use a quantidade de afirmações).
7. "etiquetas": de 2 a 5, em minúsculas, sem acento, curtas. A PRIMEIRA etiqueta é OBRIGATORIAMENTE a disciplina do curso técnico em Análises Clínicas, escrita exatamente como em uma destas opções: ${DISCIPLINAS.map((d) => d.id).join(", ")}${o.disciplina ? `. Nesta tarefa, a primeira etiqueta de TODAS as questões deve ser exatamente "${o.disciplina}"` : ". Escolha a que melhor combina com o conteúdo de cada questão"}. As demais etiquetas são o assunto específico.
8. "suportes" e o campo "suporte" só se houver texto de apoio; caso contrário, deixe "suportes" como lista vazia e omita "suporte". Cada "ref" é única.
9. Português do Brasil, linguagem técnica correta, sem ambiguidade, sem "todas as anteriores" e sem "nenhuma das anteriores".
10. Nada de HTML. Markdown simples só dentro do texto de apoio.
11. Confira o gabarito de cada questão antes de responder: a alternativa no índice "correta" tem de ser mesmo a certa.${o.formatos.aberta ? ABERTA_REGRAS : ''}`;
}
