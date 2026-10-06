/** `<input type="datetime-local">` usa o horário do navegador; o banco guarda ISO em UTC. */
const dois = (n: number) => String(n).padStart(2, '0');

export function paraInputLocal(iso: string | null): string {
	if (!iso) return '';
	const d = new Date(iso);
	if (Number.isNaN(d.getTime())) return '';
	return `${d.getFullYear()}-${dois(d.getMonth() + 1)}-${dois(d.getDate())}T${dois(d.getHours())}:${dois(d.getMinutes())}`;
}

export function deInputLocal(valor: string): string | null {
	if (!valor) return null;
	const d = new Date(valor);
	return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

export function formatarData(iso: string | null): string {
	if (!iso) return '—';
	return new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
}
