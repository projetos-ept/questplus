<svelte:head><title>Painel · QuestPlus</title></svelte:head>

<h1>Painel</h1>
<div class="grade">
	<a class="cartao" href="/admin/questoes"><strong>Banco de questões</strong><span class="suave">Cadastrar e editar MC4, MC5 e verdadeiro ou falso.</span></a>
	<a class="cartao" href="/admin/suportes"><strong>Textos de apoio</strong><span class="suave">Texto e imagem reutilizáveis entre questões.</span></a>
	<a class="cartao" href="/admin/turmas"><strong>Turmas</strong><span class="suave">Lista suspensa que o aluno vê ao entrar.</span></a>
	<a class="cartao" href="/admin/atividades"><strong>Atividades</strong><span class="suave">Monte a atividade, defina prazo e passe o código aos alunos.</span></a>
</div>

<style>
	.grade {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(16rem, 1fr));
		gap: 1rem;
	}
	a {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		color: inherit;
		text-decoration: none;
	}
	a:hover {
		border-color: var(--destaque);
	}
</style>
