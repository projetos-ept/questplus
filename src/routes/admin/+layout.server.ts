import { redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = ({ locals, url }) => {
	if (!locals.usuario) {
		if (url.pathname === '/admin/login') return { usuario: null };
		redirect(303, '/admin/login');
	}
	return { usuario: locals.usuario };
};
