import { json } from '@sveltejs/kit';
import { ehDisciplina } from '#lib/disciplinas';
import { corpoJson, erros } from '#lib/server/api';
import { acaoSuportesEmLote, filtrosSuportesDeParams, type AcaoLoteSuportes } from '#lib/server/suportes';
import type { RequestHandler } from './$types';

const ACOES: AcaoLoteSuportes[] = ['add-etiqueta', 'remover-etiqueta', 'definir-disciplina', 'excluir'];
const MAX_IDS = 500;

/** Ação em lote nos textos de apoio: `ids` (até 500) ou `filtro` (a query string do painel), mais `acao` e, se preciso, `valor`. */
export const POST: RequestHandler = async ({ request }) => {
	const c = (await corpoJson(request)) as { ids?: unknown; filtro?: unknown; acao?: unknown; valor?: unknown } | undefined;
	if (!c || typeof c.acao !== 'string' || !ACOES.includes(c.acao as AcaoLoteSuportes)) return erros(['Ação inválida.']);
	const acao = c.acao as AcaoLoteSuportes;
	let valor: string | undefined;
	if (acao !== 'excluir') {
		valor = typeof c.valor === 'string' ? c.valor.trim().toLowerCase() : '';
		if (!valor || valor.length > 40 || valor.includes(',')) return erros(['Informe a etiqueta (até 40 caracteres, sem vírgula).']);
		if (acao === 'definir-disciplina' && !ehDisciplina(valor)) return erros(['Escolha uma disciplina da lista.']);
	}
	let alvo: Parameters<typeof acaoSuportesEmLote>[0];
	if (Array.isArray(c.ids)) {
		const ids = c.ids.filter((x): x is number => Number.isInteger(x) && (x as number) > 0);
		if (!ids.length || ids.length > MAX_IDS || ids.length !== c.ids.length) return erros([`Escolha de 1 a ${MAX_IDS} textos.`]);
		alvo = { ids };
	} else if (typeof c.filtro === 'string') {
		const p = new URLSearchParams(c.filtro);
		const f = filtrosSuportesDeParams(p);
		if (acao === 'excluir' && !f.q && !f.disciplina && !f.etiquetas?.length) return erros(['Para excluir tudo, escolha os textos; excluir "todos" sem filtro não é permitido.']);
		alvo = { filtro: f };
	} else return erros(['Informe "ids" ou "filtro".']);
	return json({ afetadas: await acaoSuportesEmLote(alvo, acao, valor) });
};
