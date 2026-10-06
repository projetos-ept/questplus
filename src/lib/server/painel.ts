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
	const abertas = (await listarAtividades()).filter((a) => a.estado === 'no_prazo').slice(0, 5);
	return { numeros: n!, abertas };
}
