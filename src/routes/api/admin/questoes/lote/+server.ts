import { json } from '@sveltejs/kit';
import { ehDisciplina } from '#lib/disciplinas';
import { filtroDeParams } from '#lib/filtros';
import { corpoJson, erros } from '#lib/server/api';
import { acaoEmLote, filtrosDeParams, type AcaoLote } from '#lib/server/questoes';
import type { RequestHandler } from './$types';

const ACOES: AcaoLote[] = ['ativar', 'inativar', 'add-etiqueta', 'remover-etiqueta', 'definir-disciplina', 'excluir'];
const MAX_IDS = 500;

/** Ação em lote: `ids` (até 500) ou `filtro` (a mesma query string do painel), mais `acao` e, quando precisa, `valor`. */
export const POST: RequestHandler = async ({ request }) => {
	const c = (await corpoJson(request)) as { ids?: unknown; filtro?: unknown; acao?: unknown; valor?: unknown } | undefined;
	if (!c || typeof c.acao !== 'string' || !ACOES.includes(c.acao as AcaoLote)) return erros(['Ação inválida.']);
	const acao = c.acao as AcaoLote;
	let valor: string | undefined;
	if (acao === 'add-etiqueta' || acao === 'remover-etiqueta' || acao === 'definir-disciplina') {
		valor = typeof c.valor === 'string' ? c.valor.trim().toLowerCase() : '';
		if (!valor || valor.length > 40 || valor.includes(',')) return erros(['Informe a etiqueta (até 40 caracteres, sem vírgula).']);
	}
	let alvo: Parameters<typeof acaoEmLote>[0];
	if (Array.isArray(c.ids)) {
		const ids = c.ids.filter((x): x is number => Number.isInteger(x) && (x as number) > 0);
		if (!ids.length || ids.length > MAX_IDS || ids.length !== c.ids.length) return erros([`Escolha de 1 a ${MAX_IDS} questões.`]);
		alvo = { ids };
	} else if (typeof c.filtro === 'string') {
		const f = filtroDeParams(new URLSearchParams(c.filtro));
		const filtro = filtrosDeParams(new URLSearchParams(c.filtro));
		if (!f.q && !f.tipo && !f.disciplina && !f.etiquetas.length && !f.ativa  && acao === 'excluir') return erros(['Para excluir tudo, escolha as questões; excluir "todas" sem filtro não é permitido.']);
		alvo = { filtro };
	} else return erros(['Informe "ids" ou "filtro".']);
	if (acao === 'definir-disciplina' && valor && !ehDisciplina(valor)) return erros(['Escolha uma disciplina da lista.']);
	return json({ afetadas: await acaoEmLote(alvo, acao, valor) });
};
