export const links = {
  gasAndSolid: 'https://www.acs.org/middleschoolchemistry/lessonplans/chapter6/lesson3.html',
  citric: 'https://www.acs.org/education/resources/k-8/inquiryinaction/fifth-grade/chapter-3/different-substances-react-differently.html',
  carbonate: 'https://www.colorado.edu/lab/lecture-demo-manual/general-reactions/s130-chemical-rxns-precipitation-cacl2-na2co3-caco3',
  indicator: 'https://www.acs.org/education/activities/red-cabbage-indicator.html',
  indicatorBase: 'https://www.acs.org/education/whatischemistry/adventures-in-chemistry/experiments/lose-blues-co2.html',
  acidCarbonates: 'https://teachersinstitute.yale.edu/curriculum/units/2000/6/00.06.04/3',
  chalkAcid: 'https://www.acs.org/education/activities/mystery-minerals.html',
  chalkWater: 'https://edgerton.mit.edu/sites/default/files/2021-10/ChemicalReactionsTeachersGuide2014.pdf',
  erlenmeyer: 'https://www.innerscene.com/tools/library/3d-parts/erlenmeyer-flask-98edc983',
  round: 'https://www.innerscene.com/tools/library/3d-parts/round-bottom-flask-with-stand-19d50771',
};

export const reagents = {
  soda: { name: 'Пищевая сода', formula: 'NaHCO₃', tone: '#bdb2ff', icon: 'layers' },
  vinegar: { name: 'Уксусная кислота', formula: 'CH₃COOH', tone: '#f7ac9f', icon: 'droplet' },
  calcium: { name: 'Хлорид кальция', formula: 'CaCl₂', tone: '#ffd48d', icon: 'hexagon' },
  carbonate: { name: 'Карбонат натрия', formula: 'Na₂CO₃', tone: '#80dce7', icon: 'layers' },
  citric: { name: 'Лимонная кислота', formula: 'C₆H₈O₇', tone: '#f0de90', icon: 'hexagon' },
  indicator: { name: 'Капустный индикатор', formula: 'Антоцианы', tone: '#ec9cdf', icon: 'droplet' },
  water: { name: 'Вода', formula: 'H₂O', tone: '#91d9ff', icon: 'droplet' },
  chalk: { name: 'Мел (карбонат кальция)', formula: 'CaCO₃', tone: '#f6efdd', icon: 'hexagon' },
};

export const reactionSeconds = 14;

export const experiments = [
  {
    id: 'vinegar-soda', pair: ['soda', 'vinegar'], title: 'Сода и уксусная кислота',
    type: 'Выделение газа', icon: 'bubbles', tone: '#b6f895', gas: true,
    equation: 'NaHCO₃ + CH₃COOH → CH₃COONa + H₂O + CO₂↑',
    description: 'Пузырьки появляются, когда из раствора выходит углекислый газ. В растворе остаётся ацетат натрия.',
    source: links.gasAndSolid,
  },
  {
    id: 'calcium-carbonate', pair: ['calcium', 'carbonate'], title: 'Карбонат кальция',
    type: 'Образование осадка', icon: 'layers', tone: '#bdb2ff', precipitate: true,
    equation: 'CaCl₂ + Na₂CO₃ → CaCO₃↓ + 2NaCl',
    description: 'Из растворённых ионов образуется белый малорастворимый карбонат кальция. Смесь мутнеет, затем частицы оседают.',
    source: links.carbonate,
  },
  {
    id: 'indicator-acid', pair: ['indicator', 'vinegar'], title: 'Индикатор в кислой среде',
    type: 'Изменение цвета', icon: 'droplet', tone: '#f7acda', color: '#f273ac',
    description: 'В кислой среде антоцианы капустного индикатора меняют форму. Раствор из фиолетового становится розовым.',
    source: links.indicator,
  },
  {
    id: 'citric-soda', pair: ['soda', 'citric'], title: 'Сода и лимонная кислота',
    type: 'Выделение газа', icon: 'bubbles', tone: '#f0de90', gas: true,
    equation: '3NaHCO₃ + C₆H₈O₇ → Na₃C₆H₅O₇ + 3H₂O + 3CO₂↑',
    description: 'При нейтрализации лимонной кислоты выделяется углекислый газ. При полной нейтрализации образуется цитрат натрия.',
    source: links.citric,
  },
  {
    id: 'calcium-soda', pair: ['soda', 'calcium'], title: 'Сода и хлорид кальция',
    type: 'Газ и осадок', icon: 'bubbles', tone: '#80dce7', gas: true, precipitate: true,
    equation: 'CaCl₂ + 2NaHCO₃ → CaCO₃↓ + 2NaCl + H₂O + CO₂↑',
    description: 'В колбе одновременно видны пузырьки углекислого газа и белый осадок карбоната кальция.',
    source: links.gasAndSolid,
  },
  {
    id: 'indicator-base', pair: ['indicator', 'soda'], title: 'Индикатор в слабощелочной среде',
    type: 'Изменение цвета', icon: 'droplet', tone: '#92baff', color: '#559ceb',
    description: 'Раствор пищевой соды слабощелочной. Фиолетовый капустный индикатор становится синим или сине-зелёным, в зависимости от pH и состава экстракта.',
    source: links.indicatorBase,
  },
  {
    id: 'carbonate-vinegar', pair: ['carbonate', 'vinegar'], title: 'Карбонат натрия и уксусная кислота',
    type: 'Выделение газа', icon: 'bubbles', tone: '#a5e7db', gas: true,
    equation: 'Na₂CO₃ + 2CH₃COOH → 2CH₃COONa + H₂O + CO₂↑',
    description: 'Кислота реагирует с карбонатом натрия. В растворе остаётся ацетат натрия, а углекислый газ выходит пузырьками.',
    source: links.acidCarbonates,
  },
  {
    id: 'carbonate-citric', pair: ['carbonate', 'citric'], title: 'Карбонат натрия и лимонная кислота',
    type: 'Выделение газа', icon: 'bubbles', tone: '#f9d98e', gas: true,
    equation: '3Na₂CO₃ + 2C₆H₈O₇ → 2Na₃C₆H₅O₇ + 3H₂O + 3CO₂↑',
    description: 'При полной нейтрализации образуются цитрат натрия, вода и углекислый газ. Пузырьки показывают выделение газа.',
    source: links.acidCarbonates,
  },
  {
    id: 'indicator-citric', pair: ['indicator', 'citric'], title: 'Индикатор и лимонная кислота',
    type: 'Изменение цвета', icon: 'droplet', tone: '#ff9ca7', color: '#f04f83',
    description: 'Лимонная кислота подкисляет раствор. Капустный индикатор меняет оттенок с фиолетового на розово-красный.',
    source: links.indicator,
  },
  {
    id: 'indicator-carbonate', pair: ['indicator', 'carbonate'], title: 'Индикатор и карбонат натрия',
    type: 'Изменение цвета', icon: 'droplet', tone: '#a5f0a1', color: '#57d190',
    description: 'В растворе карбоната натрия среда щелочная. В этой модели капустный индикатор зеленеет. Оттенок зависит от pH раствора.',
    source: links.indicator,
  },
  {
    id: 'chalk-vinegar', pair: ['chalk', 'vinegar'], title: 'Мел и уксусная кислота',
    type: 'Выделение газа', icon: 'bubbles', tone: '#f5ddbb', gas: true, dissolves: true,
    equation: 'CaCO₃ + 2CH₃COOH → Ca(CH₃COO)₂ + H₂O + CO₂↑',
    description: 'На поверхности кусочков мела образуются пузырьки углекислого газа. Карбонат кальция расходуется, поэтому кусочки уменьшаются.',
    source: links.chalkAcid,
  },
  {
    id: 'chalk-water', pair: ['chalk', 'water'], title: 'Мел в воде',
    type: 'Взвесь и оседание', icon: 'layers', tone: '#d2e5f3', settles: true,
    description: 'Мел плохо растворяется в воде. Взвешенные частицы мутят жидкость и постепенно оседают на дно.',
    source: links.chalkWater,
  },
];

export const unknown = {
  title: 'Для этой пары нет опыта',
  description: 'В симуляторе ещё нет данных для этой комбинации. Выберите другие вещества или загрузите готовый опыт.',
};
export const control = {
  id: 'indicator-water', pair: ['indicator', 'water'], title: 'Индикатор в воде',
  type: 'Контрольный опыт', icon: 'droplet', tone: '#c3acf7',
  description: 'В нейтральной воде капустный индикатор сохраняет фиолетовый оттенок.',
  source: links.indicatorBase,
};

export function findExperiment(pair) {
  if (pair.includes('water') && pair.includes('indicator')) return control;
  return experiments.find((item) => item.pair.every((id) => pair.includes(id)));
}
