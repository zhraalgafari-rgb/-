/**
 * PDF text extraction in the browser using pdfjs-dist.
 * Returns concatenated text from all pages.
 */
export async function extractPdfText(file: File): Promise<string> {
  const pdfjs = await import("pdfjs-dist");
  // Use legacy worker bundled by pdfjs-dist
  const workerUrl = (await import("pdfjs-dist/build/pdf.worker.min.mjs?url")).default;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (pdfjs as any).GlobalWorkerOptions.workerSrc = workerUrl;
  const buf = await file.arrayBuffer();
  const pdf = await pdfjs.getDocument({ data: buf }).promise;
  let out = "";
  const maxPages = Math.min(pdf.numPages, 50);
  for (let i = 1; i <= maxPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const line = content.items
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((it: any) => ("str" in it ? it.str : ""))
      .join(" ");
    out += line + "\n";
  }
  return out.trim();
}
