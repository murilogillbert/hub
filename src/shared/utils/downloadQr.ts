/** Converte o <svg> do QR em PNG (fundo branco) e dispara o download. */
export async function downloadQrPng(
  svg: SVGSVGElement,
  filename: string,
  scale = 6,
): Promise<void> {
  const width = svg.viewBox.baseVal?.width || svg.clientWidth || 200;
  const height = svg.viewBox.baseVal?.height || svg.clientHeight || 200;

  const xml = new XMLSerializer().serializeToString(svg);
  const svgUrl = `data:image/svg+xml;base64,${btoa(
    unescape(encodeURIComponent(xml)),
  )}`;

  const dataUrl = await new Promise<string>((resolve, reject) => {
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

  const link = document.createElement('a');
  link.href = dataUrl;
  link.download = filename.endsWith('.png') ? filename : `${filename}.png`;
  document.body.appendChild(link);
  link.click();
  link.remove();
}
