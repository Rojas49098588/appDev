export type ColorGroup = { color: string; sizes: string[] };
export type StyleRow = { name: string; qty: number };
export type PieceBreakdown =
  | { type: 'graded'; groups: ColorGroup[] }
  | { type: 'style'; rows: StyleRow[] };

export type Piece = {
  name: string;
  colorsLabel: string;
  qty: number;
  repairCount: number;
  dirtyCount: number;
  retired?: boolean;
  breakdown: PieceBreakdown;
};

const sizeRange = (start: number, end: number, step: number) => {
  const sizes: string[] = [];
  for (let size = start; size <= end; size += step) {
    sizes.push(String(size));
  }
  return sizes;
};

export const PIECES: Piece[] = [
  {
    name: 'Coats',
    colorsLabel: 'Blue, Red, Purple, Candy',
    qty: 58,
    repairCount: 3,
    dirtyCount: 2,
    breakdown: {
      type: 'graded',
      groups: [
        { color: 'Blue', sizes: sizeRange(104, 232, 8) },
        { color: 'Red', sizes: sizeRange(108, 220, 8) },
        { color: 'Purple', sizes: sizeRange(112, 216, 8) },
        { color: 'Candy', sizes: sizeRange(116, 204, 8) },
      ],
    },
  },
  {
    name: 'Vests',
    colorsLabel: 'Candy, Red',
    qty: 56,
    repairCount: 0,
    dirtyCount: 1,
    breakdown: {
      type: 'graded',
      groups: [
        { color: 'Candy', sizes: sizeRange(112, 216, 8) },
        { color: 'Red', sizes: sizeRange(116, 220, 8) },
      ],
    },
  },
  {
    name: 'Bibbers',
    colorsLabel: 'Blue, White',
    qty: 64,
    repairCount: 2,
    dirtyCount: 0,
    breakdown: {
      type: 'graded',
      groups: [
        { color: 'Blue', sizes: sizeRange(104, 352, 8) },
        { color: 'White', sizes: sizeRange(108, 324, 8) },
      ],
    },
  },
  {
    name: 'Pants',
    colorsLabel: 'Blue, White',
    qty: 60,
    repairCount: 0,
    dirtyCount: 1,
    breakdown: {
      type: 'graded',
      groups: [
        { color: 'Blue', sizes: sizeRange(104, 336, 8) },
        { color: 'White', sizes: sizeRange(108, 308, 8) },
      ],
    },
  },
  {
    name: 'Ties',
    colorsLabel: 'One size per style',
    qty: 138,
    repairCount: 1,
    dirtyCount: 1,
    breakdown: {
      type: 'style',
      rows: [
        { name: 'Blue', qty: 40 },
        { name: 'Red', qty: 36 },
        { name: 'Purple', qty: 18 },
        { name: 'Blue bows', qty: 24 },
        { name: 'Red bows', qty: 20 },
      ],
    },
  },
  {
    name: 'Belts',
    colorsLabel: 'Red, Blue',
    qty: 80,
    repairCount: 1,
    dirtyCount: 0,
    breakdown: {
      type: 'style',
      rows: [
        { name: 'Red', qty: 48 },
        { name: 'Blue', qty: 32 },
      ],
    },
  },
];
