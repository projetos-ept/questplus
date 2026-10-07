import { json } from '@sveltejs/kit';
import { validarComponente } from '#lib/atividade';
import { corpoJson, erros, idDe } from '#lib/server/api';
import { excluirComponente, renomearComponente } from '#lib/server/componentes';
import type { RequestHandler } from './$types';

const naoEncontrado = () => erros(['Componente curricular não encontrado.'], 404);

export const PUT: RequestHandler = async ({ params, request }) => {
	const id = idDe(params.id);
	if (!id) return naoEncontrado();
	const r = validarComponente(await corpoJson(request));
	if (!r.ok) return erros(r.erros);
	const x = await renomearComponente(id, r.valor.nome);
	if (x === 'inexistente') return naoEncontrado();
	return typeof x === 'object' ? erros([x.erro], 409) : json({ id, nome: r.valor.nome });
};

/** Em uso por atividades exige `?desvincular=1` (as atividades ficam sem componente); sem isso responde 409. */
export const DELETE: RequestHandler = async ({ params, url }) => {
	const id = idDe(params.id);
	if (!id) return naoEncontrado();
	const x = await excluirComponente(id, url.searchParams.get('desvincular') === '1');
	if (x === 'inexistente') return naoEncontrado();
	if (x === 'ok') return json({ id });
	return erros([`Este componente está em ${x.em_uso} atividade(s): ${x.atividades.join(', ')}${x.em_uso > x.atividades.length ? ' e outras' : ''}. Confirme para retirá-lo delas.`], 409);
};
