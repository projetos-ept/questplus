<main>
	<h1>QuestPlus</h1>
	<p>Digite o código da atividade que o professor passou.</p>
	<form method="GET" action="/a" onsubmit={(e) => {
		e.preventDefault();
		const codigo = new FormData(e.currentTarget).get('codigo')?.toString().trim();
		if (codigo) location.href = `/a/${encodeURIComponent(codigo)}`;
	}}>
		<label>Código da atividade <input name="codigo" required autocomplete="off" /></label>
		<button type="submit">Entrar</button>
	</form>
	<p><a href="/admin">Área do professor</a></p>
</main>
