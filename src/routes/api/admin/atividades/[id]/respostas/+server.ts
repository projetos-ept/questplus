import { consolidar, montarCsv, formatarTempo, percentualDe, tempoGasto } from '#lib/relatorio';
import { erros, idDe } from '#lib/server/api';
import { exportarResultadosJson, pontosPorTentativa, questoesDaAtividade, tentativasDaAtividade } from '#lib/server/relatorio';
import { obterAtividade } from '#lib/server/atividades';
import type { RequestHandler } from './$types';

const nomeArquivo = (titulo: string, ext: string) => {
	const base = titulo.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '').toLowerCase().slice(0, 40) || 'atividade';
	return `resultados-${base}-${new Date().toISOString().slice(0, 10)}.${ext}`;
};

/** Só o professor exporta: o arquivo tem dados pessoais. `formato=json` (completo) ou `csv` (planilha); `turma=ID` filtra. */
export const GET: RequestHandler = async ({ params, url }) => {
	const id = idDe(params.id);
	const atividade = id ? await obterAtividade(id) : null;
	if (!id || !atividade) return erros(['Atividade não encontrada.'], 404);
	const turmaId = idDe(url.searchParams.get('turma') ?? '') ?? undefined;
	const formato = url.searchParams.get('formato') ?? 'json';

	if (formato === 'json') {
		const corpo = await exportarResultadosJson(id, turmaId);
		return new Response(corpo, {
			headers: { 'content-type': 'application/json; charset=utf-8', 'content-disposition': `attachment; filename="${nomeArquivo(atividade.titulo, 'json')}"`, 'cache-control': 'no-store' }
		});
	}
	if (formato === 'csv') {
		const [tentativas, questoes] = await Promise.all([tentativasDaAtividade(id, turmaId), questoesDaAtividade(id)]);
		const consideradas = new Set(consolidar(tentativas).map((a) => a.melhor.id));
		const pontos = await pontosPorTentativa(tentativas.map((t) => t.id));
		const linhas: (string | number | null)[][] = [
			['Aluno', 'Turma', 'E-mail', 'Tentativa', 'Situação', 'Considerada (maior nota)', 'Início', 'Fim', 'Tempo gasto', 'Nota', 'Pontos máximos', '%', ...questoes.map((q, i) => `Q${i + 1} (máx ${q.pontos})`)]
		];
		const ordem = new Map<string, number>();
		for (const t of tentativas) {
			const k = t.email.toLowerCase();
			ordem.set(k, (ordem.get(k) ?? 0) + 1);
			linhas.push([
				t.nome, t.turma, t.email, ordem.get(k)!,
				t.anulada ? 'Anulada' : t.status === 'finalizada' ? 'Finalizada' : 'Em andamento',
				consideradas.has(t.id) ? 'Sim' : 'Não',
				t.inicio_em, t.finalizada_em, formatarTempo(tempoGasto(t)),
				t.status === 'finalizada' && !t.anulada ? (t.nota ?? 0) : null, t.pontos_max, t.status === 'finalizada' && !t.anulada ? percentualDe(t.nota, t.pontos_max) : null,
				...questoes.map((q) => (pontos.get(t.id)?.has(q.id) ? (pontos.get(t.id)!.get(q.id) ?? 0) : null))
			]);
		}
		return new Response(montarCsv(linhas), {
			headers: { 'content-type': 'text/csv; charset=utf-8', 'content-disposition': `attachment; filename="${nomeArquivo(atividade.titulo, 'csv')}"`, 'cache-control': 'no-store' }
		});
	}
	return erros(['Use formato=json ou formato=csv.']);
};
