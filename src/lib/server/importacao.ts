import { chaveDuplicada, normalizarQuestao, type SuporteImportado } from '#lib/importacao';
import { ehDisciplina } from '#lib/disciplinas';
import { imagemDe } from '#lib/imagens';
import { formatoDe, type Aberta, type Mc, type Vf } from '#lib/questao';
import { db, midia } from './env';

export const MAX_QUESTOES_POR_REQUISICAO = 100;
/** Cada texto de apoio pode ter até 10 imagens e cada uma custa uma consulta ao R2; 4 × 10 cabe no limite de 50 do plano gratuito. */
export const MAX_SUPORTES_POR_REQUISICAO = 4;
const LETRAS = ['A', 'B', 'C', 'D', 'E'];

export type ItemResultado = {
	indice: number;
	ok: boolean;
	erros: string[];
	avisos?: string[];
	duplicada: boolean;
	formato?: string;
	enunciado?: string;
	gabarito?: string;
};

type Linha = { tipo: string; enunciado: string; config: string; explicacao: string | null; pontos: number; suporte_id: number | null; etiquetas: string; ativa: number };

/**
 * Valida (e, com `gravar`, grava) um bloco de questões. Questões inválidas nunca são gravadas; duplicadas (mesmo formato e
 * enunciado, já no banco ou antes no mesmo bloco) são puladas quando `pularDuplicadas`. Uma única instrução INSERT por bloco,
 * por causa do limite de consultas por invocação do plano gratuito.
 */
export async function processarBloco(
	brutas: unknown[],
	opcoes: { inicio: number; gravar: boolean; pularDuplicadas: boolean; mapa?: Record<string, number>; refs?: string[] }
) {
	const existentes = new Set(
		(await db().prepare('SELECT tipo, enunciado FROM questoes').all<{ tipo: string; enunciado: string }>()).results.map((q) => chaveDuplicada(q.tipo, q.enunciado))
	);
	const itens: ItemResultado[] = [];
	const linhas: Linha[] = [];

	for (const [i, bruta] of brutas.entries()) {
		const indice = opcoes.inicio + i;
		const n = normalizarQuestao(bruta);
		if (!n.ok) {
			itens.push({ indice, ok: false, erros: n.erros, duplicada: false });
			continue;
		}
		const q = n.valor;
		const erros: string[] = [];
		if (q.suporte_ref) {
			if (opcoes.mapa && !(q.suporte_ref in opcoes.mapa)) erros.push(`O texto de apoio "${q.suporte_ref}" não foi importado.`);
			else if (!opcoes.mapa && opcoes.refs && !opcoes.refs.includes(q.suporte_ref)) erros.push(`O texto de apoio "${q.suporte_ref}" não existe no arquivo.`);
		}
		const chave = chaveDuplicada(q.tipo, q.enunciado);
		const duplicada = existentes.has(chave);
		existentes.add(chave);

		const gabarito =
			q.tipo === 'aberta'
				? `${(q.config as Aberta).conceitos.length} conceito(s)`
				: q.tipo === 'mc'
					? `${LETRAS[(q.config as Mc).correta]}) ${(q.config as Mc).alternativas[(q.config as Mc).correta]}`
					: (q.config as Vf).afirmacoes.map((a) => (a.valor ? 'V' : 'F')).join(' ');
		const avisos = q.etiquetas[0] && ehDisciplina(q.etiquetas[0]) ? [] : [q.etiquetas[0] ? `A primeira etiqueta ("${q.etiquetas[0]}") não é uma disciplina da lista.` : 'Sem etiquetas: falta a disciplina (1ª etiqueta).'];
		// imagem de questão: só vale se o arquivo existir neste sistema; senão a questão entra sem imagem e o preview avisa
		const img = imagemDe(q.config);
		if (img && !(await midia()?.head(img.chave))) {
			const { imagem: _x, ...resto } = q.config as Record<string, unknown>;
			q.config = resto as typeof q.config;
			avisos.push('A imagem desta questão não existe neste sistema e foi ignorada; anexe-a depois.');
		} else if (!img && q.tinha_imagem) avisos.push('Esta questão tinha imagem ([img]) no sistema de origem; anexe-a depois, editando a questão.');
		itens.push({ indice, ok: erros.length === 0, erros, avisos, duplicada, formato: formatoDe(q.tipo, q.config), enunciado: q.enunciado, gabarito });

		if (erros.length === 0 && !(duplicada && opcoes.pularDuplicadas)) {
			linhas.push({
				tipo: q.tipo,
				enunciado: q.enunciado,
				config: JSON.stringify(q.config),
				explicacao: q.explicacao,
				pontos: q.pontos,
				suporte_id: q.suporte_ref && opcoes.mapa ? opcoes.mapa[q.suporte_ref] : null,
				etiquetas: JSON.stringify(q.etiquetas),
				ativa: q.ativa ? 1 : 0
			});
		}
	}

	let criadas = 0;
	if (opcoes.gravar && linhas.length) {
		const r = await db()
			.prepare(
				`INSERT INTO questoes (tipo, enunciado, config, explicacao, pontos, suporte_id, etiquetas, ativa)
				 SELECT json_extract(j.value, '$.tipo'), json_extract(j.value, '$.enunciado'), json_extract(j.value, '$.config'),
				        json_extract(j.value, '$.explicacao'), json_extract(j.value, '$.pontos'), json_extract(j.value, '$.suporte_id'),
				        json_extract(j.value, '$.etiquetas'), json_extract(j.value, '$.ativa')
				 FROM json_each(?) j`
			)
			.bind(JSON.stringify(linhas))
			.run();
		criadas = r.meta.changes;
	}
	const aGravar = itens.filter((x) => x.ok && !(x.duplicada && opcoes.pularDuplicadas)).length;
	return { itens, criadas, a_gravar: aGravar, puladas: itens.filter((x) => x.ok && x.duplicada && opcoes.pularDuplicadas).length };
}

/** Cria os textos de apoio do arquivo (reaproveita um idêntico que já exista) e devolve ref → id. */
export async function importarSuportes(suportes: SuporteImportado[], gravar: boolean) {
	const mapa: Record<string, number> = {};
	if (!suportes.length || !gravar) return { mapa, criados: 0, reaproveitados: 0, avisos: [] as string[] };
	const existentes = (await db().prepare('SELECT id, titulo, texto FROM suportes').all<{ id: number; titulo: string; texto: string }>()).results;
	const avisos: string[] = [];
	const novos: SuporteImportado[] = [];
	let reaproveitados = 0;

	for (const s of suportes) {
		const igual = existentes.find((e) => e.titulo === s.titulo && e.texto === s.texto);
		if (igual) {
			mapa[s.ref] = igual.id;
			reaproveitados++;
			continue;
		}
		const imagens = [];
		for (const img of s.imagens) {
			if (await midia()?.head(img.chave)) imagens.push(img);
			else avisos.push(`A imagem [img${img.n}] do texto de apoio "${s.ref}" não existe neste sistema e foi ignorada.`);
		}
		if (!s.texto && !imagens.length) {
			avisos.push(`O texto de apoio "${s.ref}" ficou sem conteúdo (só tinha imagens) e não foi criado.`);
			continue;
		}
		novos.push({ ...s, imagens });
	}
	if (novos.length) {
		const resultados = await db().batch(
			novos.map((s) => db().prepare('INSERT INTO suportes (titulo, texto, imagem_chave, imagens) VALUES (?, ?, ?, ?) RETURNING id').bind(s.titulo, s.texto, s.imagens[0]?.chave ?? null, JSON.stringify(s.imagens)))
		);
		resultados.forEach((r, i) => (mapa[novos[i].ref] = (r.results[0] as { id: number }).id));
	}
	return { mapa, criados: novos.length, reaproveitados, avisos };
}
