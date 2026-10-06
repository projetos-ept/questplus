import { redirect } from '@sveltejs/kit';
import { COOKIE_SESSAO } from '#lib/server/auth';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = ({ cookies }) => {
	cookies.delete(COOKIE_SESSAO, { path: '/' });
	redirect(303, '/admin/login');
};
