import { jsPDF } from 'jspdf';

/** Serializa o <svg> do QR pra um PNG (fundo branco) em data URL — usado
 * tanto pelo download em PNG quanto pelo PDF (embutido como imagem). */
async function svgToPngDataUrl(svg: SVGSVGElement, scale = 6): Promise<string> {
  const width = svg.viewBox.baseVal?.width || svg.clientWidth || 200;
  const height = svg.viewBox.baseVal?.height || svg.clientHeight || 200;

  const xml = new XMLSerializer().serializeToString(svg);
  const svgUrl = `data:image/svg+xml;base64,${btoa(
    unescape(encodeURIComponent(xml)),
  )}`;

  return new Promise<string>((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = width * scale;
      canvas.height = height * scale;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('canvas_context_unavailable'));
        return;
      }
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL('image/png'));
    };
    img.onerror = () => reject(new Error('svg_render_failed'));
    img.src = svgUrl;
  });
}

/** Converte o <svg> do QR em PNG (fundo branco) e dispara o download. */
export async function downloadQrPng(
  svg: SVGSVGElement,
  filename: string,
  scale = 6,
): Promise<void> {
  const dataUrl = await svgToPngDataUrl(svg, scale);
  const link = document.createElement('a');
  link.href = dataUrl;
  link.download = filename.endsWith('.png') ? filename : `${filename}.png`;
  document.body.appendChild(link);
  link.click();
  link.remove();
}

/** Gera um PDF (A4) com o QR centralizado e um título acima — pra imprimir
 * e colar no balcão/estabelecimento. */
export async function downloadQrPdf(
  svg: SVGSVGElement,
  filename: string,
  title?: string,
): Promise<void> {
  const dataUrl = await svgToPngDataUrl(svg, 8);
  const pdf = new jsPDF({ unit: 'pt', format: 'a4' });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const imgSize = 320;
  const x = (pageWidth - imgSize) / 2;
  let y = 140;

  if (title) {
    pdf.setFontSize(18);
    pdf.text(title, pageWidth / 2, 90, { align: 'center' });
  }

  pdf.addImage(dataUrl, 'PNG', x, y, imgSize, imgSize);
  y += imgSize + 40;
  pdf.setFontSize(11);
  pdf.setTextColor(120);
  pdf.text('OpenDriverHub', pageWidth / 2, y, { align: 'center' });

  pdf.save(filename.endsWith('.pdf') ? filename : `${filename}.pdf`);
}

/** "qrcode-Nome-Da-Pessoa-opendriverhub.pdf" — sem acento/espaço/caractere
 * especial, pra não quebrar em nenhum SO. */
export function qrFilename(personName: string): string {
  const slug = personName
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return `qrcode-${slug}-opendriverhub`;
}
