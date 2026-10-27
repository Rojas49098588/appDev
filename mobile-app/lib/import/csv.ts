// Minimal RFC 4180-style CSV parser (no dependency). Returns rows of cells;
// fully empty lines are dropped, lines like ",,," are kept.
export function parseCsv(text: string): string[][] {
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  let sawQuote = false; // current line contained a quoted field

  const endField = () => {
    row.push(field);
    field = '';
  };
  const endLine = () => {
    endField();
    const empty = row.length === 1 && row[0] === '' && !sawQuote;
    if (!empty) rows.push(row);
    row = [];
    sawQuote = false;
  };

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
      sawQuote = true;
    } else if (ch === ',') {
      endField();
    } else if (ch === '\n') {
      endLine();
    } else if (ch === '\r') {
      if (text[i + 1] === '\n') i++;
      endLine();
    } else {
      field += ch;
    }
  }
  if (field !== '' || row.length > 0 || sawQuote) endLine();
  return rows;
}
