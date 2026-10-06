import adapter from '@sveltejs/adapter-cloudflare';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vitest/config';

export default defineConfig({
	plugins: [sveltekit({ adapter: adapter({ platformProxy: { remoteBindings: false } }) })],
	test: { include: ['src/**/*.test.ts'] }
});
