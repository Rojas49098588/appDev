export type UniformItem = {
  piece: string;
  color: string;
  size: string;
  status: 'repair' | 'dirty';
};

export type Member = {
  name: string;
  section: string;
  item?: UniformItem;
};

export const MEMBERS: Member[] = [
  // Trumpet
  { name: 'Maya Chen', section: 'Trumpet', item: { piece: 'Coats', color: 'Blue', size: '208', status: 'dirty' } },
  { name: 'Jordan Blake', section: 'Trumpet' },
  { name: 'Priya Nair', section: 'Trumpet' },

  // Baritone
  { name: 'Owen Diaz', section: 'Baritone', item: { piece: 'Coats', color: 'Purple', size: '160', status: 'dirty' } },
  { name: 'Felix Marsh', section: 'Baritone' },

  // Piccolo
  { name: 'Ava Thornton', section: 'Piccolo' },
  { name: 'Simone Reyes', section: 'Piccolo', item: { piece: 'Coats', color: 'Red', size: '132', status: 'repair' } },

  // Alto sax
  { name: 'Noah Whitfield', section: 'Alto sax' },
  { name: 'Delilah Osei', section: 'Alto sax', item: { piece: 'Coats', color: 'Candy', size: '148', status: 'repair' } },

  // Tenor & bari sax
  { name: 'Marcus Vale', section: 'Tenor & bari sax', item: { piece: 'Coats', color: 'Blue', size: '176', status: 'repair' } },
  { name: 'Ines Calloway', section: 'Tenor & bari sax' },

  // Mellophone
  { name: 'Theo Marsh', section: 'Mellophone', item: { piece: 'Vests', color: 'Red', size: '128', status: 'dirty' } },
  { name: 'Grace Kowalski', section: 'Mellophone' },

  // Trombone
  { name: 'Ruth Okafor', section: 'Trombone', item: { piece: 'Bibbers', color: 'Blue', size: '184', status: 'repair' } },
  { name: 'Callum Doyle', section: 'Trombone', item: { piece: 'Bibbers', color: 'White', size: '212', status: 'repair' } },

  // Tuba
  { name: 'Layla Fitzgerald', section: 'Tuba', item: { piece: 'Pants', color: 'White', size: '204', status: 'dirty' } },
  { name: 'Dominic Russo', section: 'Tuba' },

  // Drumline
  { name: 'Harper Voss', section: 'Drumline', item: { piece: 'Ties', color: 'Red', size: 'One size', status: 'repair' } },
  { name: 'Elena Marsh', section: 'Drumline', item: { piece: 'Ties', color: 'Blue bows', size: 'One size', status: 'dirty' } },
  { name: 'Wyatt Chambers', section: 'Drumline', item: { piece: 'Belts', color: 'Red', size: 'One size', status: 'repair' } },
];
