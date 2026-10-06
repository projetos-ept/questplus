import { json } from '@sveltejs/kit';
import type { SuporteImportado } from '#lib/importacao';
import { validarSuporte } from '#lib/questao';
import { corpoJson, erros } from '#lib/server/api';
import { importarSuportes, MAX_QUESTOES_POR_REQUISICAO, MAX_SUPORTES_POR_REQUISICAO, processarBloco } from '#lib/server/importacao';
import type { RequestHandler } from './$types';

type Corpo = {
	suportes?: unknown[];
	questoes?: unknown[];
	inicio?: number;
	mapa?: Record<string, number>;
	refs?: string[];
	pularDuplicadas?: boolean;
};

/**
 * Importação em blocos, enviados pelo navegador (um arquivo grande numa só requisição estoura o tempo de CPU do plano gratuito).
 * Com `?validar=1` não grava nada e devolve o resultado por item. Textos de apoio e questões vão em chamadas separadas.
 */
export const POST: RequestHandler = async ({ request, url }) => {
	const corpo = (await corpoJson(request)) as Corpo | undefined;
	if (!corpo || typeof corpo !== 'object') return erros(['Corpo da requisição inválido.']);
	const gravar = url.searchParams.get('validar') !== '1';

	if (Array.isArray(corpo.suportes)) {
		if (corpo.suportes.length > MAX_SUPORTES_POR_REQUISICAO) return erros([`Envie no máximo ${MAX_SUPORTES_POR_REQUISICAO} textos de apoio por vez.`]);
		const validos: SuporteImportado[] = [];
		const problemas: string[] = [];
		for (const bruto of corpo.suportes) {
			const o = (bruto && typeof bruto === 'object' ? bruto : {}) as Record<string, unknown>;
			const v = validarSuporte({ titulo: o.titulo, texto: o.texto, imagem_chave: null });
			if (!v.ok || typeof o.ref !== 'string' || !o.ref) problemas.push(`Texto de apoio "${String(o.ref ?? '?')}" inválido.`);
			else validos.push({ ref: o.ref, ...v.valor, imagem_chave: typeof o.imagem_chave === 'string' && o.imagem_chave ? o.imagem_chave : null });
		}
		const r = await importarSuportes(validos, gravar);
		return json({ ...r, erros: problemas });
	}

	if (Array.isArray(corpo.questoes)) {
		if (corpo.questoes.length > MAX_QUESTOES_POR_REQUISICAO) return erros([`Envie no máximo ${MAX_QUESTOES_POR_REQUISICAO} questões por vez.`]);
		return json(
			await processarBloco(corpo.questoes, {
				inicio: Number.isInteger(corpo.inicio) ? (corpo.inicio as number) : 0,
				gravar,
				pularDuplicadas: corpo.pularDuplicadas !== false,
				mapa: gravar ? (corpo.mapa ?? {}) : undefined,
				refs: Array.isArray(corpo.refs) ? corpo.refs.map(String) : undefined
			})
		);
	}
	return erros(['Envie "questoes" ou "suportes".']);
};
