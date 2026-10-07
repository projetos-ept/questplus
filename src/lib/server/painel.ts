import { db } from './env';
import { listarAtividades } from './atividades';

/** Números do painel inicial, em uma única consulta, e as atividades abertas agora. */
export async function dadosDoPainel() {
	const n = await db()
		.prepare(
			`SELECT
				(SELECT COUNT(*) FROM turmas WHERE ativa = 1) AS turmas,
				(SELECT COUNT(*) FROM questoes WHERE ativa = 1) AS questoes,
				(SELECT COUNT(*) FROM suportes) AS suportes,
				(SELECT COUNT(*) FROM atividades) AS atividades,
				(SELECT COUNT(*) FROM tentativas WHERE status = 'finalizada' AND anulada = 0) AS finalizadas,
				(SELECT COUNT(*) FROM tentativas WHERE status = 'andamento' AND anulada = 0) AS andamento,
				(SELECT COUNT(*) FROM tentativas WHERE status = 'finalizada' AND anulada = 0 AND finalizada_em >= ?) AS ultimas24h`
		)
		.bind(new Date(Date.now() - 864e5).toISOString())
		.first<{ turmas: number; questoes: number; suportes: number; atividades: number; finalizadas: number; andamento: number; ultimas24h: number }>();
	// últimos 14 dias (inclui hoje): tentativas finalizadas por dia, para o gráfico, e as últimas 6 para a lista lateral
	const desde = new Date(Date.now() - 13 * 864e5).toISOString().slice(0, 10);
	const [porDia, recentes] = await db().batch([
		db()
			.prepare("SELECT substr(finalizada_em, 1, 10) AS dia, COUNT(*) AS n FROM tentativas WHERE status = 'finalizada' AND anulada = 0 AND finalizada_em >= ? GROUP BY dia")
			.bind(desde),
		db().prepare(
			`SELECT t.id, t.nome, t.nota, t.pontos_max, t.finalizada_em, a.titulo, a.id AS atividade_id
			 FROM tentativas t JOIN atividades a ON a.id = t.atividade_id
			 WHERE t.status = 'finalizada' AND t.anulada = 0 ORDER BY t.finalizada_em DESC LIMIT 6`
		)
	]);
	const mapa = new Map((porDia.results as { dia: string; n: number }[]).map((x) => [x.dia, x.n]));
	const serie = Array.from({ length: 14 }, (_, i) => {
		const dia = new Date(Date.now() - (13 - i) * 864e5).toISOString().slice(0, 10);
		return { dia, n: mapa.get(dia) ?? 0 };
	});
	const abertas = (await listarAtividades()).filter((a) => a.estado === 'no_prazo').slice(0, 5);
	return {
		numeros: n!,
		abertas,
		serie,
		recentes: recentes.results as { id: number; nome: string; nota: number | null; pontos_max: number | null; finalizada_em: string; titulo: string; atividade_id: number }[]
	};
}
