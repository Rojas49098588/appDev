import { PIECES } from './inventoryData';
import { FLAGS } from './flagsData';

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

export const INVENTORY = PIECES.map((piece) => {
  const pieceFlags = FLAGS.filter((f) => f.piece === piece.name);
  const repairCount = pieceFlags.filter((f) => f.status === 'repair').length;
  const dirtyCount = pieceFlags.filter((f) => f.status === 'dirty').length;
  return {
    piece: piece.name,
    sizes: piece.colorsLabel,
    qty: piece.qty,
    condition:
      repairCount > 0 ? `Repair (${repairCount})` : dirtyCount > 0 ? `Dirty (${dirtyCount})` : 'Good',
    warn: repairCount > 0 || dirtyCount > 0,
  };
});
