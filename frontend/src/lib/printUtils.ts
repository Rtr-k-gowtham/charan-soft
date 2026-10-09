// src/lib/printUtils.ts

/**
 * Enterprise Print Utility for Cheran Soft Goods ERP.
 * Renders the printable document inside an isolated iframe,
 * completely decoupled from the SPA application layout, sidebar, headers, and scrollbars.
 * Enforces production-grade page break controls and section integrity.
 */
export function printHtmlElement(element: HTMLElement, title = 'Cheran ERP - Purchase Order') {
  try {
    // Remove any existing print iframe
    const oldFrame = document.getElementById('csg-print-frame');
    if (oldFrame) {
      oldFrame.remove();
    }

    const iframe = document.createElement('iframe');
    iframe.id = 'csg-print-frame';
    iframe.style.position = 'fixed';
    iframe.style.top = '-9999px';
    iframe.style.left = '-9999px';
    iframe.style.width = '210mm';
    iframe.style.minWidth = '800px';
    iframe.style.height = '297mm';
    iframe.style.minHeight = '1130px';
    iframe.style.border = '0';
    iframe.style.visibility = 'hidden';
    document.body.appendChild(iframe);

    const pri = iframe.contentWindow;
    if (!pri) {
      // Fallback to window.print if iframe window not accessible
      window.print();
      return;
    }

    // Collect all stylesheets and style tags from current document
    const headElements: string[] = [];
    document.querySelectorAll('link[rel="stylesheet"]').forEach(link => {
      headElements.push((link as HTMLLinkElement).outerHTML);
    });
    document.querySelectorAll('style').forEach(style => {
      headElements.push(style.outerHTML);
    });

    const contentHtml = element.outerHTML;

    pri.document.open();
    pri.document.write(`<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${title}</title>
    ${headElements.join('\n')}
    <style>
      @page {
        size: A4 portrait;
        margin: 8mm 10mm 8mm 10mm;
      }
      *, *::before, *::after {
        box-sizing: border-box;
      }
      html, body {
        margin: 0 !important;
        padding: 0 !important;
        background: #ffffff !important;
        color: #000000 !important;
        width: 100% !important;
        min-height: 100% !important;
        height: auto !important;
        overflow: visible !important;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
        font-family: 'Poppins', sans-serif !important;
      }
      .po-template-container, .po-template-container * {
        font-family: 'Poppins', sans-serif !important;
      }
      .no-print, button, nav, header, aside, .modal-backdrop {
        display: none !important;
      }
      .po-template-container {
        width: 100% !important;
        max-width: 100% !important;
        min-height: auto !important;
        height: auto !important;
        margin: 0 !important;
        padding: 0 !important;
        box-shadow: none !important;
        border: none !important;
      }
      
      /* Production-Grade Page Break Controls */
      table {
        page-break-inside: auto;
        border-collapse: collapse;
      }
      thead {
        display: table-header-group !important;
      }
      tfoot {
        display: table-footer-group !important;
      }
      tr {
        page-break-inside: avoid !important;
        break-inside: avoid !important;
      }
      .po-header-section,
      .po-meta-section,
      .po-process-section,
      .po-totals-section,
      .po-terms-section,
      .po-signatures-section,
      .po-signature-box,
      .po-footer-section {
        page-break-inside: avoid !important;
        break-inside: avoid !important;
      }
      .po-signatures-section {
        break-before: auto;
      }
      @media print {
        body {
          margin: 0 !important;
          padding: 0 !important;
        }
        .po-template-container {
          box-shadow: none !important;
          border: none !important;
          padding: 0 !important;
        }
      }
    </style>
  </head>
  <body>
    ${contentHtml}
  </body>
</html>`);
    pri.document.close();

    // Give browser time to load styles, webfonts and images inside the iframe
    setTimeout(() => {
      pri.focus();
      pri.print();
      // Remove iframe after print dialog opens
      setTimeout(() => {
        iframe.remove();
      }, 2000);
    }, 450);
  } catch (err) {
    console.error('Print utility error:', err);
    window.print();
  }
}
