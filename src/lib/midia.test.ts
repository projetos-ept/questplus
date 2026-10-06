import { describe, expect, it } from 'vitest';
import { detectarImagem } from './midia';

const bytes = (...v: number[]) => new Uint8Array(v);
const txt = (s: string) => [...s].map((c) => c.charCodeAt(0));

describe('detectarImagem', () => {
	it('reconhece pelos bytes', () => {
		expect(detectarImagem(bytes(0x89, ...txt('PNG'), 0x0d, 0x0a, 0x1a, 0x0a))).toBe('png');
		expect(detectarImagem(bytes(0xff, 0xd8, 0xff, 0xe0))).toBe('jpg');
		expect(detectarImagem(bytes(...txt('GIF89a')))).toBe('gif');
		expect(detectarImagem(bytes(...txt('RIFF'), 0, 0, 0, 0, ...txt('WEBP')))).toBe('webp');
	});
	it('recusa SVG, HTML e vazio', () => {
		expect(detectarImagem(bytes(...txt('<svg xmlns="http://www.w3.org/2000/svg"></svg>')))).toBeNull();
		expect(detectarImagem(bytes(...txt('<html><script>')))).toBeNull();
		expect(detectarImagem(bytes())).toBeNull();
	});
});
