// src/lib/pdfUtils.ts
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { printHtmlElement } from './printUtils';

export { printHtmlElement };

/**
 * Downloads a DOM element as a crisp, production-grade PDF file using html2canvas & jsPDF.
 * Renders at 2x resolution to ensure text, barcode, colors, and tables remain razor-sharp.
 */
export async function downloadElementAsPdf(
  element: HTMLElement,
  filename: string,
  options: {
    pageTitle?: string;
    marginMm?: number;
    quality?: number;
  } = {}
): Promise<void> {
  const marginMm = options.marginMm ?? 10;
  const quality = options.quality ?? 0.95;

  try {
    // Scroll element into view and wait briefly for any font/image paint
    const canvas = await html2canvas(element, {
      scale: 2, // High DPI capture
      useCORS: true,
      allowTaint: true,
      logging: false,
      backgroundColor: '#ffffff',
      windowWidth: element.scrollWidth > 800 ? element.scrollWidth : 1024,
      onclone: (clonedDoc) => {
        // Ensure cloned element is visible and expanded
        const clonedEl = clonedDoc.getElementById(element.id) || clonedDoc.body;
        if (clonedEl) {
          (clonedEl as HTMLElement).style.width = '100%';
          (clonedEl as HTMLElement).style.maxWidth = '210mm';
          (clonedEl as HTMLElement).style.margin = '0 auto';
        }
      },
    });

    const imgData = canvas.toDataURL('image/jpeg', quality);

    // Standard A4 portrait: 210mm x 297mm
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
      compress: true,
    });

    const pdfPageWidth = 210;
    const pdfPageHeight = 297;
    const contentWidth = pdfPageWidth - marginMm * 2;
    const contentHeight = (canvas.height * contentWidth) / canvas.width;
    const maxPageContentHeight = pdfPageHeight - marginMm * 2;

    let heightLeft = contentHeight;
    let positionY = marginMm;
    let pageNum = 1;

    // First page
    pdf.addImage(imgData, 'JPEG', marginMm, positionY, contentWidth, contentHeight);
    heightLeft -= maxPageContentHeight;

    // Subsequent pages if content overflows A4 height
    while (heightLeft > 2) {
      pdf.addPage();
      pageNum++;
      positionY = marginMm - (pageNum - 1) * maxPageContentHeight;
      pdf.addImage(imgData, 'JPEG', marginMm, positionY, contentWidth, contentHeight);
      heightLeft -= maxPageContentHeight;
    }

    const cleanFilename = filename.toLowerCase().endsWith('.pdf') ? filename : `${filename}.pdf`;
    pdf.save(cleanFilename);
  } catch (error) {
    console.error('Error generating PDF download:', error);
    throw error;
  }
}
