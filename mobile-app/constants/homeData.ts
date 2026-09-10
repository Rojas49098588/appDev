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

export const CATALOGUE = [
  { label: 'Combo 01', sub: 'Field — home' },
  { label: 'Combo 02', sub: 'Field — away' },
  { label: 'Combo 03', sub: 'Parade — formal' },
  { label: 'Combo 04', sub: 'Parade — summer' },
  { label: 'Combo 05', sub: 'Concert' },
];

export const INVENTORY = [
  { piece: 'Jacket', sizes: 'Sizes 32–52', qty: 148, condition: 'Good' as const },
  { piece: 'Bibbers', sizes: 'Sizes 28–44', qty: 150, condition: 'Good' as const },
  { piece: 'Shako', sizes: 'Sizes S–XL', qty: 140, condition: 'Repair (6)' as const, warn: true },
  { piece: 'Gloves', sizes: 'Sizes S–XL', qty: 200, condition: 'Good' as const },
  { piece: 'Plume', sizes: 'One size', qty: 140, condition: 'Repair (3)' as const, warn: true },
];
