// Espelha o padrão de C:\consultorio (exportReport.ts): CSV via Blob e
// "PDF" via relatório HTML imprimível aberto em nova aba (window.print()).

export function downloadTextFile(
  filename: string,
  content: string,
  mimeType: string,
) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function openPrintableReport(filename: string, html: string) {
  const documentHtml = `<!doctype html>${html}`;
  const blob = new Blob([documentHtml], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const win = window.open(url, '_blank', 'noopener,noreferrer');

  if (!win) {
    // Pop-up bloqueado: cai para download do HTML.
    downloadTextFile(
      filename.replace(/\.pdf$/i, '.html'),
      documentHtml,
      'text/html;charset=utf-8',
    );
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    return;
  }
  window.setTimeout(() => URL.revokeObjectURL(url), 30000);
}

/** Escapa um valor para célula CSV (separador ';', aspas duplicadas). */
export const csvCell = (value: unknown) =>
  `"${String(value ?? '').replace(/"/g, '""')}"`;

/** Monta um CSV (com BOM para o Excel abrir acentuação correta). */
export function buildCsv(rows: string[]) {
  const BOM = String.fromCharCode(0xfeff);
  return `${BOM}${rows.join('\n')}`;
}

/** Escapa texto para uso seguro dentro do HTML do relatório. */
export const htmlEscape = (value: unknown) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
