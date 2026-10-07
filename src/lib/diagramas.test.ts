import { describe, expect, it } from 'vitest';
import { MAX_DIAGRAMAS, contarDiagramas, renderSuporte } from './suporte';
import { validarSuporte } from './questao';

const fluxo = 'graph TD\n  A[Coleta] --> B[Centrifugação]\n  B --> C[Análise]';
const texto = (cod = fluxo) => `Antes do fluxo.\n\n\`\`\`mermaid\n${cod}\n\`\`\`\n\nDepois do fluxo.`;

describe('diagramas Mermaid no texto de apoio', () => {
	it('o bloco vira um contêiner com o código escapado, entre os parágrafos', () => {
		const r = renderSuporte(texto(), []);
		expect(r.diagramas).toBe(1);
		expect(r.html).toMatch(/<p>Antes do fluxo\.<\/p><div class="mermaid-bloco" data-mermaid><pre class="mermaid-fonte">graph TD\n {2}A\[Coleta\] --&gt; B\[Centrifugação\]/);
		expect(r.html).toMatch(/<\/div><p>Depois do fluxo\.<\/p>$/);
	});
	it('HTML dentro do diagrama é escapado, nunca vira HTML', () => {
		const r = renderSuporte(texto('graph TD\n A["<img src=x onerror=alert(1)>"] --> B'), []);
		expect(r.html).not.toContain('<img');
		expect(r.html).toContain('&lt;img src=x onerror=alert(1)&gt;');
	});
	it('convive com as imagens [imgN]', () => {
		const imgs = [{ n: 1, chave: '123e4567-e89b-12d3-a456-426614174000.png', legenda: '', tamanho: 'media' as const, largura: null, origem: null }];
		const r = renderSuporte(`[img1]\n\n\`\`\`mermaid\n${fluxo}\n\`\`\``, imgs);
		expect(r.html.indexOf('suporte-img')).toBeLessThan(r.html.indexOf('mermaid-bloco'));
		expect(r.naoCitadas).toEqual([]);
	});
	it('passou do limite: os extras aparecem como código, sem desenhar', () => {
		const muitos = Array.from({ length: MAX_DIAGRAMAS + 2 }, () => `\`\`\`mermaid\n${fluxo}\n\`\`\``).join('\n\n');
		const r = renderSuporte(muitos, []);
		expect((r.html.match(/class="mermaid-bloco"/g) ?? []).length).toBe(MAX_DIAGRAMAS);
		expect((r.html.match(/<pre class="mermaid-fonte">/g) ?? []).length).toBe(MAX_DIAGRAMAS + 2);
	});
	it('contar e validar', () => {
		expect(contarDiagramas(texto())).toEqual({ total: 1, grandes: 0 });
		expect(contarDiagramas(texto('x'.repeat(3001)))).toEqual({ total: 1, grandes: 1 });
		expect(validarSuporte({ titulo: 'T', texto: texto() }).ok).toBe(true);
		expect(validarSuporte({ titulo: 'T', texto: texto('x'.repeat(3001)) }).ok).toBe(false);
		const muitos = Array.from({ length: MAX_DIAGRAMAS + 1 }, () => texto()).join('\n\n');
		expect(validarSuporte({ titulo: 'T', texto: muitos }).ok).toBe(false);
	});
	it('texto sem diagrama continua igual', () => {
		const r = renderSuporte('Só **texto**.', []);
		expect(r.diagramas).toBe(0);
		expect(r.html).toBe('<p>Só <strong>texto</strong>.</p>');
	});
});
