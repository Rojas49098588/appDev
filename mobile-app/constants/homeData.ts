import { COMBOS } from './combosData';

export const STATS = [
  { label: 'members', value: '122' },
  { label: 'sections', value: '9' },
  { label: 'outfit combinations', value: '36' },
  { label: 'pieces flagged for repair', value: '12', flag: true },
];

export const SECTIONS = [
  { name: 'Piccolo', count: 9, fitPercent: 100 },
  { name: 'Alto sax', count: 14, fitPercent: 93 },
  { name: 'Tenor & bari sax', count: 8, fitPercent: 100 },
  { name: 'Trumpet', count: 22, fitPercent: 86 },
  { name: 'Mellophone', count: 12, fitPercent: 100 },
  { name: 'Baritone', count: 10, fitPercent: 90 },
  { name: 'Trombone', count: 13, fitPercent: 100 },
  { name: 'Tuba', count: 8, fitPercent: 100 },
  { name: 'Drumline', count: 26, fitPercent: 81 },
];

export const CATALOGUE = COMBOS.slice(0, 5).map(({ id, label, sub }) => ({ id, label, sub }));
