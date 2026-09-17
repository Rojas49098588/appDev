const INSTRUMENT_TO_SECTION: Record<string, string> = {
  Piccolo: 'Piccolo',
  'Alto Saxophone': 'Alto sax',
  'Tenor Saxophone': 'Tenor & bari sax',
  'Bari Saxophone': 'Tenor & bari sax',
  Trumpet: 'Trumpet',
  Mellophone: 'Mellophone',
  Baritone: 'Baritone',
  Trombone: 'Trombone',
  Tuba: 'Tuba',
  Drumline: 'Drumline',
};

export function sectionForInstrument(instrument: string): string {
  return INSTRUMENT_TO_SECTION[instrument] ?? instrument;
}
