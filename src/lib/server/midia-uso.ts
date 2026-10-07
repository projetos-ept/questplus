import { db, midia } from './env';

/**
 * Apaga do R2 as imagens que ninguém mais usa. Uma imagem está em uso se aparece em outro texto de apoio, em alguma
 * tentativa já feita (a prova guarda cópia do apoio e das questões) ou em alguma questão. `ignorarSuporteId` é o apoio que
 * está sendo editado ou excluído agora.
 */
export async function apagarImagensSemUso(chaves: string[], ignorarSuporteId = 0) {
	for (const chave of chaves) {
		const uso = await db()
			.prepare(
				`SELECT (SELECT COUNT(*) FROM suportes WHERE id <> ? AND instr(imagens, ?) > 0) +
				        (SELECT COUNT(*) FROM tentativas WHERE instr(questoes, ?) > 0 OR instr(COALESCE(suporte, ''), ?) > 0) +
				        (SELECT COUNT(*) FROM questoes WHERE instr(config, ?) > 0) AS n`
			)
			.bind(ignorarSuporteId, chave, chave, chave, chave)
			.first<{ n: number }>();
		if (uso!.n === 0) await midia()?.delete(chave);
	}
}
