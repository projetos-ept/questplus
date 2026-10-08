<script lang="ts">
	import { formatarData } from '#lib/data';
	import QrAtividade from '#lib/components/QrAtividade.svelte';

	let { data } = $props();
	const n = $derived(data.numeros);
	// passo a passo para quem está começando: cada passo some quando o sistema já tem o que ele pede
	const passos = $derived([
		{ feito: n.turmas > 0, texto: 'Cadastre ao menos uma turma', href: '/admin/turmas' },
		{ feito: n.questoes > 0, texto: 'Crie ou importe questões', href: '/admin/questoes' },
		{ feito: n.atividades > 0, texto: 'Monte uma atividade e copie o link', href: '/admin/atividades/nova' },
		{ feito: n.finalizadas > 0, texto: 'Passe o link aos alunos e acompanhe as respostas', href: '/admin/atividades' }
	]);
	const comecando = $derived(passos.some((p) => !p.feito));

	// gráfico: barras de tentativas finalizadas por dia (14 dias)
	const maxN = $derived(Math.max(1, ...data.serie.map((d) => d.n)));
	const totalSerie = $derived(data.serie.reduce((s, d) => s + d.n, 0));
	const L = 560, A = 190, MARGEM = 28, BASE = A - 26;
	const passo = L / 14;
	const rotuloDia = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
	const pct = (nota: number | null, max: number | null) => (nota !== null && max ? `${Math.round((nota / max) * 100)}%` : '—');
</script>

<svelte:head><title>Painel · QuestPlus</title></svelte:head>

<div class="topo">
	<div>
		<h1>Painel</h1>
		<p class="suave">Visão geral das suas atividades e dos alunos.</p>
	</div>
	<a class="botao" href="/admin/atividades/nova">Nova atividade</a>
</div>

{#if comecando}
	<section class="cartao comeco" aria-labelledby="t-passos">
		<h2 id="t-passos">Primeiros passos</h2>
		<ol>
			{#each passos as p}
				<li class:feito={p.feito}>{p.feito ? '✔' : '○'} <a href={p.href}>{p.texto}</a>{p.feito ? ' — feito' : ''}</li>
			{/each}
		</ol>
	</section>
{/if}

<section class="indicadores" aria-label="Indicadores">
	<div class="cartao ind">
		<span class="rot">Tentativas finalizadas</span>
		<strong>{n.finalizadas}</strong>
		<span class="suave">{n.ultimas24h} nas últimas 24 h · {n.andamento} em andamento</span>
	</div>
	<a class="cartao ind acao-card" href="/admin/atividades">
		<span class="rot">Atividades</span>
		<strong>{n.atividades}</strong>
		<span class="suave">{data.abertas.length} aberta(s) agora</span>
	</a>
	<a class="cartao ind acao-card" href="/admin/questoes">
		<span class="rot">Questões ativas</span>
		<strong>{n.questoes}</strong>
		<span class="suave">{n.suportes} texto(s) de apoio · {n.turmas} turma(s) ativa(s)</span>
	</a>
</section>

<div class="meio">
	<section class="cartao grafico" aria-labelledby="t-graf">
		<h2 id="t-graf">Tentativas por dia</h2>
		<p class="suave">Últimos 14 dias: {totalSerie} tentativa(s) finalizada(s).</p>
		<figure>
			<svg viewBox="0 0 {L + MARGEM} {A}" role="img" aria-label="Gráfico de barras: tentativas finalizadas por dia nos últimos 14 dias, total {totalSerie}. A tabela abaixo traz os mesmos números.">
				<line x1={MARGEM} x2={L + MARGEM} y1={BASE} y2={BASE} class="eixo" />
				<line x1={MARGEM} x2={L + MARGEM} y1={BASE - (BASE - 14)} y2={BASE - (BASE - 14)} class="grade-linha" />
				<text x={MARGEM - 6} y={20} text-anchor="end" class="num">{maxN}</text>
				<text x={MARGEM - 6} y={BASE + 4} text-anchor="end" class="num">0</text>
				{#each data.serie as d, i (d.dia)}
					{@const h = (d.n / maxN) * (BASE - 14)}
					<g>
						<title>{rotuloDia(d.dia)}: {d.n} tentativa(s)</title>
						<rect x={MARGEM + i * passo + 5} y={BASE - h} width={passo - 10} height={Math.max(h, d.n ? 2 : 0)} rx="4" class="barra" />
						{#if d.n > 0}<text x={MARGEM + i * passo + passo / 2} y={BASE - h - 5} text-anchor="middle" class="valor">{d.n}</text>{/if}
						{#if (13 - i) % 2 === 0}<text x={MARGEM + i * passo + passo / 2} y={BASE + 16} text-anchor="middle" class="dia">{rotuloDia(d.dia)}</text>{/if}
					</g>
				{/each}
			</svg>
		</figure>
		<details>
			<summary>Ver como tabela</summary>
			<div class="rolagem">
				<table>
					<caption class="so-leitor">Tentativas finalizadas por dia</caption>
					<thead><tr><th scope="col">Dia</th><th scope="col">Tentativas</th></tr></thead>
					<tbody>{#each data.serie as d (d.dia)}<tr><th scope="row">{rotuloDia(d.dia)}</th><td>{d.n}</td></tr>{/each}</tbody>
				</table>
			</div>
		</details>
	</section>

	<section class="cartao lateral" aria-labelledby="t-rec">
		<h2 id="t-rec">Atividade recente</h2>
		{#if data.recentes.length === 0}
			<p class="suave">Ainda não há tentativas finalizadas.</p>
		{:else}
			<ul>
				{#each data.recentes as r (r.id)}
					<li>
						<span class="avatar" aria-hidden="true">{r.nome.trim().slice(0, 1).toUpperCase()}</span>
						<span class="info">
							<a href="/admin/tentativas/{r.id}/relatorio">{r.nome}</a>
							<span class="suave">{r.titulo} · {formatarData(r.finalizada_em)}</span>
						</span>
						<span class="nota" title="Rendimento">{pct(r.nota, r.pontos_max)}</span>
					</li>
				{/each}
			</ul>
		{/if}
	</section>
</div>

<section class="cartao tabela" aria-labelledby="t-abertas">
	<div class="cab-tabela"><h2 id="t-abertas">Atividades abertas agora</h2><a href="/admin/relatorios">Ver relatórios</a></div>
	{#if data.abertas.length === 0}
		<p class="suave">Nenhuma atividade aberta no momento. <a href="/admin/atividades">Ver todas</a></p>
	{:else}
		<div class="rolagem" tabindex="-1">
			<table>
				<caption class="so-leitor">Atividades abertas agora</caption>
				<thead><tr><th scope="col">Atividade</th><th scope="col">QR code</th><th scope="col">Código</th><th scope="col">Tentativas</th><th scope="col"><span class="so-leitor">Ações</span></th></tr></thead>
				<tbody>
					{#each data.abertas as a (a.id)}
						<tr>
							<td><a href="/admin/atividades/{a.id}">{a.titulo}</a>{#if a.componente}<div class="suave">{a.componente}</div>{/if}</td>
							<td><QrAtividade codigo={a.codigo} titulo={a.titulo} /></td>
							<td><code>{a.codigo}</code></td>
							<td>{a.n_tentativas}</td>
							<td><a href="/admin/relatorios/{a.id}">Relatório</a></td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{/if}
</section>

<style>
	.topo { display: flex; flex-wrap: wrap; gap: 0.5rem 1rem; align-items: flex-start; justify-content: space-between; }
	.topo h1 { margin: 0; }
	.topo p { margin: 0.2rem 0 0; }
	.botao { display: inline-flex; align-items: center; min-height: var(--altura-controle); padding: 0 1.15rem; font-weight: var(--peso-acao); color: var(--sobre-primaria); text-decoration: none; background: var(--primaria); border-radius: calc(var(--raio) / 2); box-shadow: 3px 3px 8px color-mix(in srgb, var(--texto) 18%, transparent), -3px -3px 8px var(--superficie); transition: transform var(--transicao) var(--easing), box-shadow var(--transicao) var(--easing); }
	.botao:hover { transform: translateY(var(--deslocamento-hover)); box-shadow: var(--sombra-hover); }
	.botao:active { transform: translateY(1px); box-shadow: var(--sombra-interna); }
	section { margin-top: var(--espaco); }
	h2 { margin: 0 0 0.35rem; font-size: var(--escala-h3); }
	.comeco { border-color: var(--primaria); }
	.comeco ol { margin: 0.25rem 0 0; padding-left: 0; list-style: none; }
	.comeco li { padding: 0.2rem 0; }
	.comeco li.feito { color: var(--texto-secundario); }

	.indicadores { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: var(--espaco); }
	.ind { display: flex; flex-direction: column; gap: 0.15rem; color: inherit; text-decoration: none; }
	.ind strong { font-size: var(--escala-h1); line-height: 1.1; letter-spacing: var(--tracking); }
	.rot { font-size: var(--escala-sm); font-weight: var(--peso-acao); color: var(--texto-secundario); }
	.acao-card { transition: transform var(--transicao) var(--easing), box-shadow var(--transicao) var(--easing); }
	.acao-card:hover { transform: translateY(var(--deslocamento-hover)); box-shadow: var(--sombra-hover); }
	.acao-card:active { transform: translateY(1px); box-shadow: var(--sombra-interna); }

	.meio { display: grid; grid-template-columns: minmax(0, 2fr) minmax(0, 1fr); gap: var(--espaco); margin-top: var(--espaco); }
	.meio section { margin-top: 0; }
	.grafico p { margin: 0 0 0.5rem; }
	figure { margin: 0; }
	svg { display: block; width: 100%; height: auto; }
	.eixo { stroke: var(--borda); stroke-width: 1; }
	.grade-linha { stroke: color-mix(in srgb, var(--borda) 35%, var(--superficie)); stroke-width: 1; stroke-dasharray: 3 4; }
	.barra { fill: var(--primaria); transition: opacity var(--transicao) var(--easing); }
	g:hover .barra { opacity: 0.8; }
	.valor, .num, .dia { fill: var(--texto-secundario); font-size: 11px; }
	.valor { fill: var(--texto); font-weight: var(--peso-acao); }
	details { margin-top: 0.5rem; }
	summary { cursor: pointer; font-weight: var(--peso-acao); color: var(--primaria); }
	.so-leitor { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }

	.lateral ul { margin: 0.5rem 0 0; padding: 0; list-style: none; }
	.lateral li { display: grid; grid-template-columns: 2.25rem minmax(0, 1fr) auto; gap: 0.65rem; align-items: center; padding: 0.55rem 0; border-bottom: var(--borda-espessura) var(--borda-estilo) color-mix(in srgb, var(--borda) 35%, var(--superficie)); }
	.lateral li:last-child { border-bottom: 0; }
	.avatar { display: grid; place-items: center; width: 2.25rem; height: 2.25rem; font-weight: var(--peso-acao); color: var(--sobre-secundaria); background: var(--secundaria); border-radius: 50%; }
	.info { display: flex; flex-direction: column; min-width: 0; font-size: var(--escala-sm); }
	.info a { font-weight: var(--peso-acao); overflow-wrap: anywhere; }
	.info .suave { overflow-wrap: anywhere; }
	.nota { font-weight: var(--peso-titulo); color: var(--primaria); }

	.cab-tabela { display: flex; flex-wrap: wrap; gap: 0.25rem 1rem; align-items: baseline; justify-content: space-between; }
	.rolagem { overflow-x: auto; }

	@media (max-width: 960px) {
		.meio { grid-template-columns: minmax(0, 1fr); }
	}
	@media (max-width: 640px) {
		.indicadores { grid-template-columns: minmax(0, 1fr); }
		.topo .botao { width: 100%; justify-content: center; }
	}
</style>
