import { beforeNavigate } from '$app/navigation';

/**
 * Pergunta antes de sair de uma tela com alterações não salvas: vale para trocar de página dentro do sistema
 * (confirmação) e para fechar ou recarregar a aba (aviso do próprio navegador). Chamar durante a criação do componente.
 */
export function protegerSaida(alterado: () => boolean) {
	beforeNavigate(({ cancel, willUnload }) => {
		if (!alterado() || (window as unknown as { __qpSaidaForcada?: boolean }).__qpSaidaForcada) return;
		if (willUnload) return void cancel(); // aba fechada ou recarregada: o navegador mostra o aviso dele
		if (!confirm('Você tem alterações não salvas. Sair mesmo assim?')) cancel();
	});
}
