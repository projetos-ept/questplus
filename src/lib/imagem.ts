/** Reduz a imagem no navegador antes do envio (o servidor não tem biblioteca de imagem). GIF passa sem alteração. */
export async function reduzir(arquivo: File, maxLado = 1600): Promise<File> {
	if (!/^image\/(png|jpeg|webp)$/.test(arquivo.type)) return arquivo;
	let bmp: ImageBitmap;
	try {
		bmp = await createImageBitmap(arquivo);
	} catch {
		return arquivo;
	}
	const escala = Math.min(1, maxLado / Math.max(bmp.width, bmp.height));
	if (escala === 1 && arquivo.size <= 1_500_000) {
		bmp.close();
		return arquivo;
	}
	const canvas = document.createElement('canvas');
	canvas.width = Math.round(bmp.width * escala);
	canvas.height = Math.round(bmp.height * escala);
	canvas.getContext('2d')!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
	bmp.close();
	const tipo = arquivo.type === 'image/jpeg' ? 'image/jpeg' : 'image/webp';
	const blob = await new Promise<Blob | null>((ok) => canvas.toBlob(ok, tipo, 0.85));
	return blob && blob.size < arquivo.size ? new File([blob], 'imagem', { type: tipo }) : arquivo;
}
