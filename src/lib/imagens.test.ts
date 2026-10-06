import { describe, expect, it } from 'vitest';
import { imagensDe, larguraDe, proximoNumero, urlPermitida, validarImagens, type ImagemSuporte } from './imagens';
import { renderSuporte } from './suporte';

const K = (n: number) => `3f2b8c1e-aaaa-4bbb-8ccc-12345678${String(n).padStart(4, '0')}.png`;
const img = (n: number, extra: Partial<Record<keyof ImagemSuporte, unknown>> = {}) => ({ n, chave: K(n), legenda: '', tamanho: 'media', largura: null, origem: null, ...extra }) as ImagemSuporte;

describe('validarImagens', () => {
	it('aceita até 10, ordena por número e aplica padrões', () => {
		const r = validarImagens([img(3), { n: 1, chave: K(1) }]);
		expect(r.ok && r.valor.map((i) => i.n)).toEqual([1, 3]);
		expect(r.ok && r.valor[0]).toMatchObject({ tamanho: 'media', legenda: '', largura: null });
		expect(validarImagens(Array.from({ length: 10 }, (_, i) => img(i + 1))).ok).toBe(true);
	});
	it('recusa a 11ª, número repetido ou fora da faixa, chave ruim e arquivo repetido', () => {
		expect(validarImagens(Array.from({ length: 11 }, (_, i) => img(i + 1))).ok).toBe(false);
		expect(validarImagens([img(1), img(1, { chave: K(2) })]).ok).toBe(false);
		expect(validarImagens([img(0)]).ok).toBe(false);
		expect(validarImagens([img(11)]).ok).toBe(false);
		expect(validarImagens([img(1, { chave: '../segredo' })]).ok).toBe(false);
		expect(validarImagens([img(1), img(2, { chave: K(1) })]).ok).toBe(false);
	});
	it('legenda, tamanho e largura personalizada', () => {
		expect(validarImagens([img(1, { legenda: 'x'.repeat(301) })]).ok).toBe(false);
		expect(validarImagens([img(1, { tamanho: 'gigante' })]).ok).toBe(false);
		expect(validarImagens([img(1, { tamanho: 'personalizada', largura: 300 })]).ok).toBe(true);
		expect(validarImagens([img(1, { tamanho: 'personalizada', largura: 10 })]).ok).toBe(false);
		expect(validarImagens([img(1, { tamanho: 'personalizada', largura: 2000 })]).ok).toBe(false);
		expect(validarImagens([img(1, { tamanho: 'personalizada' })]).ok).toBe(false);
		const r = validarImagens([img(1, { tamanho: 'grande', largura: 5 })]);
		expect(r.ok && r.valor[0].largura).toBeNull();
	});
	it('ausente vira lista vazia; lixo é recusado', () => {
		expect(validarImagens(undefined)).toMatchObject({ ok: true, valor: [] });
		expect(validarImagens('x').ok).toBe(false);
	});
});

describe('números, larguras e formato antigo', () => {
	it('escolhe o menor número livre e acusa quando acabou', () => {
		expect(proximoNumero([])).toBe(1);
		expect(proximoNumero([{ n: 1 }, { n: 3 }])).toBe(2);
		expect(proximoNumero(Array.from({ length: 10 }, (_, i) => ({ n: i + 1 })))).toBeNull();
	});
	it('largura por tamanho', () => {
		expect(larguraDe({ tamanho: 'pequena', largura: null })).toBe(240);
		expect(larguraDe({ tamanho: 'media', largura: null })).toBe(420);
		expect(larguraDe({ tamanho: 'grande', largura: null })).toBe(640);
		expect(larguraDe({ tamanho: 'personalizada', largura: 300 })).toBe(300);
	});
	it('lê o formato antigo (imagem_chave) como imagem 1', () => {
		expect(imagensDe({ imagem_chave: K(1) })).toEqual([img(1)]);
		expect(imagensDe({ imagens: [img(2)], imagem_chave: K(1) })).toEqual([img(2)]);
		expect(imagensDe({ imagens: [], imagem_chave: null })).toEqual([]);
		expect(imagensDe(null)).toEqual([]);
	});
});

describe('urlPermitida (proteção contra SSRF)', () => {
	it('aceita links públicos http(s)', () => {
		expect(urlPermitida('https://upload.wikimedia.org/a/b/c.png').ok).toBe(true);
		expect(urlPermitida('http://exemplo.com/i.jpg').ok).toBe(true);
	});
	it('recusa localhost, IPs (inclusive em formatos disfarçados), nomes internos, portas e credenciais', () => {
		for (const u of ['http://localhost/x.png', 'http://127.0.0.1/x.png', 'http://10.0.0.5/x.png', 'http://192.168.0.1/x.png', 'http://169.254.169.254/latest/meta-data',
			'http://2130706433/x.png', 'http://0x7f.1/x.png', 'http://[::1]/x.png', 'http://intranet/x.png', 'http://servidor.local/x.png', 'http://api.internal/x.png',
			'https://exemplo.com:8443/x.png', 'https://user:senha@exemplo.com/x.png']) {
			expect(urlPermitida(u).ok, u).toBe(false);
		}
	});
	it('recusa protocolos que não são http(s) e lixo', () => {
		for (const u of ['ftp://exemplo.com/a.png', 'file:///etc/passwd', 'javascript:alert(1)', 'data:image/png;base64,AAAA', 'não é link', '']) expect(urlPermitida(u).ok, u).toBe(false);
	});
	it('permitirLocal (só testes) libera localhost mas continua exigindo http(s)', () => {
		expect(urlPermitida('http://127.0.0.1:9999/x.png', true).ok).toBe(true);
		expect(urlPermitida('file:///etc/passwd', true).ok).toBe(false);
	});
});

describe('renderSuporte', () => {
	it('põe a imagem onde o marcador está, com legenda e largura', () => {
		const r = renderSuporte('Antes\n\n[img1]\n\nDepois', [img(1, { legenda: 'Coração', tamanho: 'grande' })]);
		expect(r.html).toMatch(/<p>Antes<\/p><figure class="suporte-img"><img src="\/midia\/[^"]+" alt="Coração" loading="lazy" style="width:640px"><figcaption>Coração<\/figcaption><\/figure><p>Depois<\/p>/);
		expect(r.naoCitadas).toEqual([]);
	});
	it('marcador no meio da frase divide o parágrafo e cada imagem aparece onde foi citada', () => {
		const r = renderSuporte('veja [img2] e [img1] aqui', [img(1), img(2)]);
		expect(r.html.indexOf(K(2))).toBeLessThan(r.html.indexOf(K(1)));
	});
	it('imagens não citadas vão para o final e são avisadas', () => {
		const r = renderSuporte('Só texto', [img(1), img(2)]);
		expect(r.html.endsWith('</figure>')).toBe(true);
		expect(r.html.indexOf(K(1))).toBeLessThan(r.html.indexOf(K(2)));
		expect(r.naoCitadas).toEqual(['[img1]', '[img2]']);
	});
	it('marcador sem imagem fica visível no texto e é avisado', () => {
		const r = renderSuporte('veja [img7]', [img(1)]);
		expect(r.html).toContain('[img7]');
		expect(r.semImagem).toEqual(['[img7]']);
	});
	it('a mesma imagem pode ser citada duas vezes', () => {
		expect((renderSuporte('[img1] e de novo [img1]', [img(1)]).html.match(/<figure/g) ?? []).length).toBe(2);
	});
	it('escapa a legenda e o texto (nada de HTML ou script)', () => {
		const r = renderSuporte('<script>alert(1)</script>', [img(1, { legenda: '"><script>x</script>' })]);
		expect(r.html).not.toContain('<script');
		expect(r.html).toContain('alt="&quot;&gt;&lt;script&gt;x&lt;/script&gt;"');
		expect(r.html).toContain('<figcaption>&quot;&gt;&lt;script&gt;x&lt;/script&gt;</figcaption>');
	});
	it('sem imagens, é só o markdown', () => {
		expect(renderSuporte('**oi**', []).html).toBe('<p><strong>oi</strong></p>');
	});
});
