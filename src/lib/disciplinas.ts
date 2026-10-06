/**
 * Disciplinas do curso técnico em Análises Clínicas. A primeira etiqueta de toda questão deve ser uma delas
 * (o prompt de IA exige isso e os filtros usam a primeira etiqueta como "disciplina"). Para incluir ou renomear,
 * edite esta lista: `id` é o texto gravado na etiqueta (minúsculas, sem acento), `nome` é o que o professor vê.
 */
export const DISCIPLINAS = [
	{ id: 'anatomia-e-fisiologia', nome: 'Anatomia e Fisiologia Humana' },
	{ id: 'biologia-celular-e-molecular', nome: 'Biologia Celular e Molecular' },
	{ id: 'biosseguranca', nome: 'Biossegurança' },
	{ id: 'coleta-de-materiais', nome: 'Coleta de Materiais Biológicos' },
	{ id: 'quimica-e-bioquimica-basica', nome: 'Química e Bioquímica Básica' },
	{ id: 'bioquimica-clinica', nome: 'Bioquímica Clínica' },
	{ id: 'hematologia', nome: 'Hematologia' },
	{ id: 'imunologia-e-sorologia', nome: 'Imunologia e Sorologia' },
	{ id: 'microbiologia', nome: 'Microbiologia' },
	{ id: 'parasitologia', nome: 'Parasitologia' },
	{ id: 'uroanalise', nome: 'Uroanálise' },
	{ id: 'citologia-e-histotecnica', nome: 'Citologia e Histotécnica' },
	{ id: 'controle-de-qualidade', nome: 'Controle de Qualidade e Gestão Laboratorial' },
	{ id: 'etica-e-legislacao', nome: 'Ética Profissional e Legislação' }
] as const;

export const nomeDaDisciplina = (id: string) => DISCIPLINAS.find((d) => d.id === id)?.nome ?? id;
export const ehDisciplina = (id: string) => DISCIPLINAS.some((d) => d.id === id);
