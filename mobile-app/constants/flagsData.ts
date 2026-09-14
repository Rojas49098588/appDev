export type FlagStatus = 'dirty' | 'repair';

export type Flag = {
  id: string;
  memberName: string;
  piece: string;
  color: string;
  size: string;
  status: FlagStatus;
  comment: string;
};

const flag = (
  memberName: string,
  piece: string,
  color: string,
  size: string,
  status: FlagStatus
): Flag => ({
  id: `${memberName}-${piece}`,
  memberName,
  piece,
  color,
  size,
  status,
  comment: '',
});

export const FLAGS: Flag[] = [
  flag('Maya Chen', 'Coats', 'Blue', '208', 'dirty'),
  flag('Owen Diaz', 'Coats', 'Purple', '160', 'dirty'),
  flag('Simone Reyes', 'Coats', 'Red', '132', 'repair'),
  flag('Delilah Osei', 'Coats', 'Candy', '148', 'repair'),
  flag('Marcus Vale', 'Coats', 'Blue', '176', 'repair'),
  flag('Theo Marsh', 'Vests', 'Red', '128', 'dirty'),
  flag('Ruth Okafor', 'Bibbers', 'Blue', '184', 'repair'),
  flag('Callum Doyle', 'Bibbers', 'White', '212', 'repair'),
  flag('Layla Fitzgerald', 'Pants', 'White', '204', 'dirty'),
  flag('Harper Voss', 'Ties', 'Red', 'One size', 'repair'),
  flag('Elena Marsh', 'Ties', 'Blue bows', 'One size', 'dirty'),
  flag('Wyatt Chambers', 'Belts', 'Red', 'One size', 'repair'),
];
