export type Combo = {
  id: string;
  label: string;
  sub: string;
  // Only combos actually referenced by a game (constants/gamesData.ts) need this —
  // it drives the "Components" chips on the Member Game Day screen.
  components?: string[];
};

export const COMBOS: Combo[] = [
  {
    id: 'combo-01',
    label: 'Combo 01',
    sub: 'Field — home',
    components: ['White hat', 'Red bowtie', 'Red vest', 'White bibbers', 'Spats', 'White gloves'],
  },
  {
    id: 'combo-02',
    label: 'Combo 02',
    sub: 'Field — away',
  },
  {
    id: 'combo-03',
    label: 'Combo 03',
    sub: 'Parade — formal',
  },
  {
    id: 'combo-04',
    label: 'Combo 04',
    sub: 'Parade — summer',
  },
  {
    id: 'combo-05',
    label: 'Combo 05',
    sub: 'Concert',
  },
  {
    id: 'combo-06',
    label: 'Combo 06',
    sub: 'TBD',
  },
  {
    id: 'combo-07',
    label: 'Combo 07',
    sub: 'TBD',
  },
  {
    id: 'combo-08',
    label: 'Combo 08',
    sub: 'TBD',
  },
  {
    id: 'combo-09',
    label: 'Combo 09',
    sub: 'TBD',
  },
  {
    id: 'combo-10',
    label: 'Combo 10',
    sub: 'TBD',
  },
  {
    id: 'combo-11',
    label: 'Combo 11',
    sub: 'TBD',
  },
  {
    id: 'combo-14',
    label: 'Combo 14',
    sub: 'Halftime formation',
    components: ['White hat', 'Blue bowtie', 'Blue vest', 'White bibbers', 'Spats', 'White gloves'],
  },
];
