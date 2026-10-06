import { describe, expect, it } from 'vitest';
import { renderMarkdown } from './markdown';

describe('renderMarkdown', () => {
	it('escapa HTML e script', () => {
		const h = renderMarkdown('<script>alert(1)</script> <img src=x onerror=alert(1)>');
		expect(h).not.toContain('<script');
		expect(h).not.toContain('<img');
		expect(h).toContain('&lt;script&gt;');
	});
	it('só linka http(s) e não deixa escapar do atributo', () => {
		expect(renderMarkdown('[x](javascript:alert(1))')).not.toContain('<a');
		const h = renderMarkdown('[x](https://a.com/"onmouseover="alert(1))');
		expect(h).not.toContain('onmouseover="');
		expect(renderMarkdown('[site](https://exemplo.com/a*b*c)')).toContain('href="https://exemplo.com/a*b*c"');
	});
	it('formata negrito, itálico, listas e parágrafos', () => {
		expect(renderMarkdown('**a** e *b*')).toBe('<p><strong>a</strong> e <em>b</em></p>');
		expect(renderMarkdown('- um\n- dois')).toBe('<ul><li>um</li><li>dois</li></ul>');
		expect(renderMarkdown('1. a\n2. b')).toBe('<ol><li>a</li><li>b</li></ol>');
		expect(renderMarkdown('p1\n\np2')).toBe('<p>p1</p><p>p2</p>');
	});
	it('não deixa marcador interno vazar', () => {
		expect(renderMarkdown('\u00000\u0000 texto')).not.toContain('undefined');
	});
});
