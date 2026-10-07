import { DISCIPLINAS } from './disciplinas';
import { lerJson } from './importacao';
import { validarSuporte, type Resultado, type Suporte } from './questao';
import { MAX_CHARS_DIAGRAMA, MAX_DIAGRAMAS } from './suporte';

export const FORMATO_SUPORTES = 'questplus-suportes';
export const VERSAO_SUPORTES = 1;
export const MAX_SUPORTES_POR_ARQUIVO = 200;
/** Cada texto pode ter imagens e cada uma custa uma consulta ao R2: poucos por requisição (limite de 50 consultas por invocação). */
export const TAMANHO_BLOCO_SUPORTES = 4;

/** Aceita o arquivo completo, uma lista de textos ou um texto solto (com cerca de código ou frase em volta). */
export function lerArquivoSuportes(texto: string): Resultado<{ suportes: unknown[] }> {
	const lido = lerJson(texto);
	if (!lido.ok) return lido;
	const dados = lido.valor;
	let bruto: unknown[];
	if (Array.isArray(dados)) bruto = dados;
	else if (dados && typeof dados === 'object' && Array.isArray((dados as { suportes?: unknown }).suportes)) bruto = (dados as { suportes: unknown[] }).suportes;
	else if (dados && typeof dados === 'object' && 'titulo' in dados) bruto = [dados];
	else return { ok: false, erros: ['O JSON precisa ter uma lista "suportes" (ou ser uma lista de textos de apoio).'] };
	if (bruto.length === 0) return { ok: false, erros: ['Não há nenhum texto de apoio no arquivo.'] };
	if (bruto.length > MAX_SUPORTES_POR_ARQUIVO) return { ok: false, erros: [`O arquivo tem ${bruto.length} textos; o limite é ${MAX_SUPORTES_POR_ARQUIVO} por importação.`] };
	return { ok: true, valor: { suportes: bruto } };
}

export type SuporteNormalizado = Suporte & { tinha_imagem: boolean };

/** Um texto de apoio vindo do arquivo, tolerante a variações comuns de IA (etiquetas como texto, "conteudo" no lugar de "texto"). */
export function normalizarSuporte(bruto: unknown): Resultado<SuporteNormalizado> {
	const o = (bruto && typeof bruto === 'object' ? bruto : {}) as Record<string, unknown>;
	const etiquetas = Array.isArray(o.etiquetas) ? o.etiquetas : typeof o.etiquetas === 'string' ? o.etiquetas.split(',') : o.disciplina ? [o.disciplina] : [];
	const r = validarSuporte({ titulo: o.titulo, texto: o.texto ?? o.conteudo, imagens: o.imagens, imagem_chave: o.imagem_chave, etiquetas });
	if (!r.ok) return r;
	return { ok: true, valor: { ...r.valor, tinha_imagem: typeof o.observacao === 'string' && /\[img\]/i.test(o.observacao) } };
}

/** Chave para achar textos repetidos: mesmo título e mesmo texto, ignorando espaços a mais. */
export const chaveSuporte = (titulo: string, texto: string) => `${titulo.replace(/\s+/g, ' ').trim()}|${texto.replace(/\s+/g, ' ').trim()}`;

export function montarExportacaoSuportes(suportes: (Suporte & { id?: number })[], quando = new Date()) {
	return {
		formato: FORMATO_SUPORTES,
		versao: VERSAO_SUPORTES,
		exportado_em: quando.toISOString(),
		suportes: suportes.map((s) => ({
			titulo: s.titulo,
			texto: s.texto,
			etiquetas: s.etiquetas,
			// as imagens só valem neste sistema (o arquivo delas fica no R2 daqui); em outro sistema são ignoradas na importação
			...(s.imagens.length && { imagens: s.imagens, observacao: `[img] Este texto tem ${s.imagens.length} imagem(ns) que só funcionam neste sistema; em outro, anexe-as de novo.` })
		}))
	};
}

// ---------- instrução para IA ----------

export type OpcoesPromptSuporte = {
	tema: string;
	quantidade: number;
	/** curto (cerca de 600 caracteres), médio (1200) ou longo (2500). */
	tamanho: 'curto' | 'médio' | 'longo';
	/** Id da disciplina (1ª etiqueta) de todos os textos ('' = a IA escolhe entre as da lista). */
	disciplina: string;
	etiquetas: string;
	comDiagrama: boolean;
};

export const OPCOES_PROMPT_SUPORTE_PADRAO: OpcoesPromptSuporte = {
	tema: '[ESCREVA O TEMA OU COLE O CONTEÚDO BASE AQUI]',
	quantidade: 3,
	tamanho: 'médio',
	disciplina: '',
	etiquetas: '',
	comDiagrama: true
};

const CARACTERES = { curto: 600, médio: 1200, longo: 2500 } as const;

const REGRAS_MERMAID = `
10. DIAGRAMAS (Mermaid): quando o conteúdo for um processo, ciclo, fluxo, sequência ou classificação, inclua UM diagrama no texto, escrito como bloco de código dentro da string "texto", assim (no JSON, as quebras de linha viram \\n):
    "…parágrafo antes.\\n\\n\`\`\`mermaid\\nflowchart TD\\n  A[\\"Coleta do sangue\\"] --> B[\\"Centrifugação\\"]\\n  B --> C{\\"Hemólise?\\"}\\n  C -- \\"Sim\\" --> D[\\"Nova coleta\\"]\\n  C -- \\"Não\\" --> E[\\"Análise\\"]\\n\`\`\`\\n\\nparágrafo depois."
    Regras do diagrama: no máximo ${MAX_DIAGRAMAS} por texto e ${MAX_CHARS_DIAGRAMA} caracteres cada; prefira "flowchart TD" ou "flowchart LR" (também valem "sequenceDiagram", "stateDiagram-v2" e "pie"); TODO rótulo entre aspas duplas (escapadas como \\" no JSON); rótulos curtos, sem HTML, sem acento em identificadores (A, B, C…), sem "click", sem estilos e sem comentários. Só inclua diagrama se ele ajudar; se o tema não pedir, não force.`;

export function montarPromptSuporteIA(o: OpcoesPromptSuporte): string {
	const etiquetas = o.etiquetas
		.split(',')
		.map((e) => e.trim().toLowerCase())
		.filter(Boolean);
	return `Você é um professor do curso técnico em Análises Clínicas e vai escrever TEXTOS DE APOIO: textos-base que o aluno lê antes de responder a um conjunto de questões (um caso, uma situação de bancada, um trecho teórico). Crie ${o.quantidade} texto(s) de apoio sobre o tema a seguir.

TEMA / CONTEÚDO BASE:
${o.tema.trim() || OPCOES_PROMPT_SUPORTE_PADRAO.tema}

TAMANHO DE CADA TEXTO: ${o.tamanho} (cerca de ${CARACTERES[o.tamanho]} caracteres)${etiquetas.length ? `\nETIQUETAS A USAR EM TODOS OS TEXTOS: ${etiquetas.join(', ')}` : ''}

Responda SOMENTE com um JSON válido, sem nenhum texto antes ou depois e sem bloco de código markdown em volta do JSON, exatamente neste formato:

{
  "formato": "${FORMATO_SUPORTES}",
  "versao": ${VERSAO_SUPORTES},
  "suportes": [
    {
      "titulo": "Título curto e descritivo do texto de apoio",
      "texto": "Texto em Markdown simples, com **negrito**, *itálico* e listas quando ajudar.",
      "etiquetas": ["hematologia", "assunto"]
    }
  ]
}

REGRAS OBRIGATÓRIAS:
1. "titulo": até 200 caracteres. "texto": Markdown simples (parágrafos separados por linha em branco, listas com "- ", **negrito**, *itálico*, links [texto](https://…)); no JSON, as quebras de linha dentro da string são "\\n".
2. "etiquetas": de 2 a 5, em minúsculas, sem acento, curtas. A PRIMEIRA etiqueta é OBRIGATORIAMENTE a disciplina do curso técnico em Análises Clínicas, escrita exatamente como em uma destas opções: ${DISCIPLINAS.map((d) => d.id).join(', ')}${o.disciplina ? `. Nesta tarefa, a primeira etiqueta de TODOS os textos deve ser exatamente "${o.disciplina}"` : '. Escolha a que melhor combina com o conteúdo de cada texto'}. As demais etiquetas são o assunto específico.
3. Cada texto é independente e será mostrado antes da questão 1 de uma atividade; escreva-o para servir de base a várias questões, sem fazer perguntas dentro dele e sem dar respostas de questões.
4. Conteúdo tecnicamente correto, em português do Brasil, linguagem de sala de aula técnica, sem inventar valores de referência ou normas; se citar valores, use faixas aceitas e diga que variam conforme o método.
5. Não use HTML nem códigos de imagem como [img1]: o texto de apoio pode ganhar imagens depois, no painel.
6. Não repita o mesmo texto com palavras trocadas: cada um deve ter foco diferente dentro do tema.
7. Não inclua dados pessoais reais de pacientes: use casos fictícios.
8. Confira o texto antes de responder: nomes de exames, unidades e termos técnicos escritos corretamente.
9. O JSON precisa ser válido: aspas duplas, vírgulas, "\\n" nas quebras de linha, sem comentários.${o.comDiagrama ? REGRAS_MERMAID : ''}`;
}
