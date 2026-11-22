export const links = {
  gasAndSolid: 'https://www.acs.org/middleschoolchemistry/lessonplans/chapter6/lesson3.html',
  citric: 'https://www.acs.org/education/resources/k-8/inquiryinaction/fifth-grade/chapter-3/different-substances-react-differently.html',
  carbonate: 'https://www.colorado.edu/lab/lecture-demo-manual/general-reactions/s130-chemical-rxns-precipitation-cacl2-na2co3-caco3',
  indicator: 'https://www.acs.org/education/activities/red-cabbage-indicator.html',
  indicatorBase: 'https://www.acs.org/education/whatischemistry/adventures-in-chemistry/experiments/lose-blues-co2.html',
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
};

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
];

export const unknown = {
  title: 'Для этой пары нет опыта',
  description: 'В симуляторе ещё нет данных для этой комбинации. Выберите другие вещества или загрузите готовый опыт.',
};
export const control = {
  id: 'indicator-water', title: 'Индикатор в воде', type: 'Контрольный опыт', color: '#9e69e2',
  description: 'В нейтральной воде капустный индикатор сохраняет фиолетовый оттенок.',
  source: links.indicatorBase,
};

export function findExperiment(pair) {
  if (pair.includes('water') && pair.includes('indicator')) return control;
  return experiments.find((item) => item.pair.every((id) => pair.includes(id)));
}
