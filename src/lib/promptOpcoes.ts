import { OPCOES_PROMPT_PADRAO, type OpcoesPrompt } from './importacao';

const CHAVE = 'qp_prompt_opcoes_v2';

/** Opções da instrução para IA que o professor usou por último (no navegador dele); sem nada guardado, vale o padrão atual. */
export function carregarOpcoesPrompt(): OpcoesPrompt {
	const padrao = { ...OPCOES_PROMPT_PADRAO, formatos: { ...OPCOES_PROMPT_PADRAO.formatos } };
	try {
		const bruto = JSON.parse(localStorage.getItem(CHAVE) ?? 'null') as Partial<OpcoesPrompt> | null;
		if (!bruto || typeof bruto !== 'object') return padrao;
		return { ...padrao, ...bruto, formatos: { ...padrao.formatos, ...(bruto.formatos ?? {}) } };
	} catch {
		return padrao;
	}
}

export function salvarOpcoesPrompt(o: OpcoesPrompt) {
	try {
		localStorage.setItem(CHAVE, JSON.stringify(o));
	} catch {
		// sem armazenamento (janela privada): só deixa de lembrar
	}
}

// ---------- textos de apoio ----------
import { OPCOES_PROMPT_SUPORTE_PADRAO, type OpcoesPromptSuporte } from './importacao-suportes';

const CHAVE_SUPORTE = 'qp_prompt_suporte_opcoes_v1';

export function carregarOpcoesPromptSuporte(): OpcoesPromptSuporte {
	try {
		const bruto = JSON.parse(localStorage.getItem(CHAVE_SUPORTE) ?? 'null') as Partial<OpcoesPromptSuporte> | null;
		return bruto && typeof bruto === 'object' ? { ...OPCOES_PROMPT_SUPORTE_PADRAO, ...bruto } : { ...OPCOES_PROMPT_SUPORTE_PADRAO };
	} catch {
		return { ...OPCOES_PROMPT_SUPORTE_PADRAO };
	}
}

export function salvarOpcoesPromptSuporte(o: OpcoesPromptSuporte) {
	try {
		localStorage.setItem(CHAVE_SUPORTE, JSON.stringify(o));
	} catch {
		// sem armazenamento: só deixa de lembrar
	}
}
