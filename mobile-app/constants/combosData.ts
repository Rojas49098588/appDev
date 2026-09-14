export type Combo = {
  id: string;
  label: string;
  sub: string;
  components: string[];
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
    components: ['White hat', 'Blue bowtie', 'Blue vest', 'White bibbers', 'Spats', 'White gloves'],
  },
  {
    id: 'combo-03',
    label: 'Combo 03',
    sub: 'Parade — formal',
    components: ['Shako', 'Plume', 'Coat', 'Bibbers', 'Gloves'],
  },
  {
    id: 'combo-04',
    label: 'Combo 04',
    sub: 'Parade — summer',
    components: ['Shako', 'Coat', 'Bibbers', 'Gloves'],
  },
  {
    id: 'combo-05',
    label: 'Combo 05',
    sub: 'Concert',
    components: ['Concert black', 'Bowtie'],
  },
  {
    id: 'combo-14',
    label: 'Combo 14',
    sub: 'Halftime formation',
    components: ['White hat', 'Blue bowtie', 'Blue vest', 'White bibbers', 'Spats', 'White gloves'],
  },
];
