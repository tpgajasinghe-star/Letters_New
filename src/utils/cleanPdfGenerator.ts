import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { WarrantyFormData, WarrantyTableRow } from '../types';
import {
  KEVILTON_COMPANY_NAME,
  StyledSpan,
  resolveLetterContent,
  splitStyledSpans,
} from './letterContent';

/**
 * Formats the first column "Product Description",
 * combining Item Code ("I Code") and Item Description if both are provided.
 */
export function formatProductDescription(item: Partial<WarrantyTableRow & { productFamily?: string }>): string {
  const code = item.itemCode?.trim();
  const desc = (item.description || item.productType || '').trim();

  if (code && desc) {
    if (desc.toLowerCase().startsWith(code.toLowerCase())) {
      return desc;
    }
    return `${code} - ${desc}`;
  }
  return desc || code || '[Product Description]';
}

/**
 * Extracts rows from structured items or fallback for both letter formats:
 * 1st Column: Product Description (I Code & Item Description)
 * 2nd Column: Product Brand (shows Product Family / Brand)
 * 3rd Column: Warranty Period
 */
export function getWarrantyRows(formData: WarrantyFormData): WarrantyTableRow[] {
  if (formData.items && formData.items.length > 0) {
    return formData.items.map((item, idx) => {
      const fullDesc = formatProductDescription(item);
      const brand = (item.productBrand || item.productFamily || item.productType || 'Wiring Devices').trim();
      return {
        itemCode: item.itemCode?.trim() || `ITEM-${idx + 1}`,
        description: fullDesc,
        productType: fullDesc,
        warrantyPeriod: item.warrantyPeriod?.trim() || '1 Year',
        productBrand: brand || 'Wiring Devices',
      };
    });
  }

  return [
    {
      itemCode: 'KEV-101',
      description: 'KEV-101 - 1 Gang 1 Way Switch 10A White',
      warrantyPeriod: '5 Years',
      productType: '1 Gang 1 Way Switch 10A White',
      productBrand: 'Wiring Devices',
    },
  ];
}

/**
 * Computes the product brand subject title for common draft warranty letters:
 * e.g. "Warranty Declaration for Wiring Devices"
 */
export function getProductBrandSubject(rows: WarrantyTableRow[]): string {
  const brands = Array.from(
    new Set(rows.map((r) => r.productBrand?.trim()).filter(Boolean))
  ) as string[];

  if (brands.length === 0) {
    return 'Wiring Devices';
  }
  if (brands.length === 1) {
    return brands[0];
  }
  if (brands.length === 2) {
    return `${brands[0]} & ${brands[1]}`;
  }
  return `${brands.slice(0, -1).join(', ')} & ${brands[brands.length - 1]}`;
}

/**
 * Renders paragraphs with mixed normal and bold text spans,
 * wrapping words at maxWidth while preserving exact baseline and spacing.
 */
function renderRichParagraph(
  doc: jsPDF,
  spans: StyledSpan[],
  x: number,
  startY: number,
  maxWidth: number,
  fontSize: number = 10.5,
  lineHeight: number = 5.2
): number {
  doc.setFontSize(fontSize);

  // Tokenize into words while keeping styling (preserving explicit newlines)
  const words: { text: string; bold: boolean; isSpace?: boolean; isNewline?: boolean }[] = [];
  for (const span of spans) {
    const isBold = !!span.bold;
    const rawLines = span.text.split('\n');
    rawLines.forEach((rawLine, lineIdx) => {
      if (lineIdx > 0) {
        words.push({ text: '', bold: isBold, isNewline: true });
      }
      const parts = rawLine.split(/(\s+)/);
      for (const part of parts) {
        if (!part) continue;
        if (/^\s+$/.test(part)) {
          words.push({ text: ' ', bold: isBold, isSpace: true });
        } else {
          words.push({ text: part, bold: isBold, isSpace: false });
        }
      }
    });
  }

  interface LineChunk {
    text: string;
    bold: boolean;
    width: number;
    isSpace?: boolean;
  }
  const lines: LineChunk[][] = [];
  let currentLine: LineChunk[] = [];
  let currentLineWidth = 0;

  for (const item of words) {
    if (item.isNewline) {
      while (currentLine.length > 0 && currentLine[currentLine.length - 1].isSpace) {
        currentLineWidth -= currentLine.pop()!.width;
      }
      lines.push(currentLine);
      currentLine = [];
      currentLineWidth = 0;
      continue;
    }

    doc.setFont('times', item.bold ? 'bold' : 'normal');
    const w = doc.getTextWidth(item.text);

    if (item.isSpace) {
      if (currentLine.length > 0) {
        currentLine.push({ text: ' ', bold: item.bold, width: w, isSpace: true });
        currentLineWidth += w;
      }
      continue;
    }

    if (currentLineWidth + w > maxWidth && currentLine.length > 0) {
      while (currentLine.length > 0 && currentLine[currentLine.length - 1].isSpace) {
        currentLineWidth -= currentLine.pop()!.width;
      }
      lines.push(currentLine);
      currentLine = [];
      currentLineWidth = 0;
    }

    currentLine.push({ text: item.text, bold: item.bold, width: w });
    currentLineWidth += w;
  }

  if (currentLine.length > 0) {
    while (currentLine.length > 0 && currentLine[currentLine.length - 1].isSpace) {
      currentLine.pop();
    }
    lines.push(currentLine);
  }

  let cursorY = startY;
  for (const line of lines) {
    let curX = x;
    for (const chunk of line) {
      doc.setFont('times', chunk.bold ? 'bold' : 'normal');
      doc.text(chunk.text, curX, cursorY);
      curX += chunk.width;
    }
    cursorY += lineHeight;
  }

  return cursorY;
}

/**
 * Generates an official, pristine PDF without any header logos, decorative rules,
 * watermarks, rubber seals, or signature blocks.
 *
 * Page geometry:
 * - Letter Portrait (8.5 in x 11 in / 215.9mm x 279.4mm)
 * - Normal Margins: Top = 1 in (25.4mm), Bottom = 1 in (25.4mm), Left = 1 in (25.4mm), Right = 1 in (25.4mm)
 * - Typography: Times New Roman
 * - Header row: Plain white / no shading
 */
export async function generateCleanWarrantyPdf(formData: WarrantyFormData): Promise<Blob> {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'letter', // 8.5 x 11 inches (215.9mm x 279.4mm)
  });

  const rows = getWarrantyRows(formData);
  const brandSubject = getProductBrandSubject(rows);
  const content = resolveLetterContent(formData, rows, brandSubject);

  // Normal 1-inch margins on all 4 sides (1" = 25.4 mm)
  const marginX = 25.4; // 1 inch Left & Right
  const marginY = 25.4; // 1 inch Top & Bottom
  const pageWidth = 215.9; // 8.5 inches
  const printableWidth = pageWidth - marginX * 2; // 165.1 mm (6.5 inches)

  let cursorY = marginY; // Starting at exactly 1 inch (25.4mm) top margin

  // 1. Date (Bold in template)
  doc.setFont('times', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(0, 0, 0);
  doc.text(content.dateText || '', marginX, cursorY);
  cursorY += 9;

  // 2. Recipient Address Block (First line like Mr./Ms. [Customer Name] is bold)
  const addrLines = content.addressLines;
  for (let i = 0; i < addrLines.length; i++) {
    doc.setFont('times', i === 0 ? 'bold' : 'normal');
    doc.text(addrLines[i], marginX, cursorY);
    cursorY += 5.5;
  }
  cursorY += 4;

  if (content.isPoCertificate) {
    // ==========================================
    // 2. Common Warranty Certificate (PO Based)
    // ==========================================
    // Subject Line (Entire line bold)
    doc.setFont('times', 'bold');
    doc.setFontSize(11.5);
    const subjectLines = doc.splitTextToSize(content.subject, printableWidth);
    doc.text(subjectLines, marginX, cursorY);
    cursorY += subjectLines.length * 5.8 + 4;

    // Salutation (Bold in template)
    doc.setFont('times', 'bold');
    doc.setFontSize(11);
    doc.text(content.salutation, marginX, cursorY);
    cursorY += 7.5;

    // Opening Paragraph 1
    if (content.introParagraph1.trim()) {
      cursorY =
        renderRichParagraph(
          doc,
          splitStyledSpans(content.introParagraph1, [
            KEVILTON_COMPANY_NAME,
            content.referenceName,
          ]),
          marginX,
          cursorY,
          printableWidth,
          10.5,
          5.2
        ) + 3.5;
    }

    // Opening Paragraph 2
    if (content.introParagraph2.trim()) {
      cursorY =
        renderRichParagraph(
          doc,
          splitStyledSpans(content.introParagraph2, [content.poNumberText]),
          marginX,
          cursorY,
          printableWidth,
          10.5,
          5.2
        ) + 4;
    }

    // Section header (Bold in template)
    if (content.itemsHeader.trim()) {
      doc.setFont('times', 'bold');
      doc.setFontSize(10.5);
      doc.text(content.itemsHeader, marginX, cursorY);
      cursorY += 4.5;
    }

    // Table: 1. Product Description | 2. Product Brand | 3. Warranty Period (Plain white header, no shading)
    const tableData = rows.map((r) => [
      r.description,
      r.productBrand || 'Wiring Devices',
      r.warrantyPeriod,
    ]);

    autoTable(doc, {
      startY: cursorY,
      margin: { left: marginX, right: marginX, top: marginY, bottom: marginY },
      head: [['Product Description', 'Product Brand', 'Warranty Period']],
      body: tableData,
      theme: 'grid',
      headStyles: {
        fillColor: false,
        textColor: [0, 0, 0],
        font: 'times',
        fontStyle: 'bold',
        fontSize: 10,
        lineWidth: 0.2,
        lineColor: [0, 0, 0],
      },
      styles: {
        font: 'times',
        fontSize: 10,
        textColor: [0, 0, 0],
        cellPadding: 3,
        lineWidth: 0.2,
        lineColor: [0, 0, 0],
      },
      columnStyles: {
        0: { cellWidth: 76 },
        1: { cellWidth: 44 },
        2: { cellWidth: 45.1 },
      },
    });

    // @ts-expect-error autoTable adds lastAutoTable to doc
    cursorY = doc.lastAutoTable.finalY + 6.5;

    // Optional Note Below Table (if With Note is selected and has content)
    if (content.hasNote && content.noteText.trim()) {
      cursorY =
        renderRichParagraph(
          doc,
          splitStyledSpans(`Note: ${content.noteText}`, ['Note:']),
          marginX,
          cursorY,
          printableWidth,
          10.5,
          5.0
        ) + 3.5;
    }

    // Note & Disclaimers
    content.bodyParagraphs.forEach((paragraph, idx) => {
      if (!paragraph.trim()) return;
      const spacingAfter = idx === content.bodyParagraphs.length - 1 ? 4 : 3;
      cursorY =
        renderRichParagraph(
          doc,
          splitStyledSpans(paragraph, [KEVILTON_COMPANY_NAME]),
          marginX,
          cursorY,
          printableWidth,
          10.5,
          5.0
        ) + spacingAfter;
    });

    doc.setFont('times', 'normal');
    doc.setFontSize(10.5);
    if (content.thankYou.trim()) {
      doc.text(content.thankYou, marginX, cursorY);
      cursorY += 6.5;
    }

    if (content.closing.trim()) {
      doc.text(content.closing, marginX, cursorY);
      cursorY += 16;
    }

    // Clean text signature line (no rubber stamp, no signature image)
    doc.setFont('times', 'normal');
    doc.setFontSize(10);
    doc.text(content.signatureLine, marginX, cursorY);
    cursorY += 5;

    doc.setFont('times', 'bold');
    doc.text(content.signatoryTitle, marginX, cursorY);
    cursorY += 5;
    doc.text(content.signatoryCompany, marginX, cursorY);
  } else {
    // ==========================================
    // 1. Common Draft Warranty Certificate (Declaration)
    // ==========================================

    // Salutation (Bold in template)
    doc.setFont('times', 'bold');
    doc.setFontSize(11);
    doc.text(content.salutation, marginX, cursorY);
    cursorY += 8;

    // Heading: Warranty Declaration for [Product Brand] (Bold in template)
    doc.setFont('times', 'bold');
    doc.setFontSize(11.5);
    const titleLines = doc.splitTextToSize(content.subject, printableWidth);
    doc.text(titleLines, marginX, cursorY);
    cursorY += titleLines.length * 5.5 + 4;

    // Paragraph 1 (with reference name and Kevilton bold)
    if (content.introParagraph1.trim()) {
      cursorY =
        renderRichParagraph(
          doc,
          splitStyledSpans(content.introParagraph1, [
            content.referenceName,
            KEVILTON_COMPANY_NAME,
          ]),
          marginX,
          cursorY,
          printableWidth,
          10.5,
          5.0
        ) + 3.5;
    }

    // Table: 1. Product Description | 2. Product Brand | 3. Warranty Period (Plain white header, no shading)
    const tableData = rows.map((r) => [
      r.description,
      r.productBrand || 'Wiring Devices',
      r.warrantyPeriod,
    ]);

    autoTable(doc, {
      startY: cursorY,
      margin: { left: marginX, right: marginX, top: marginY, bottom: marginY },
      head: [['Product Description', 'Product Brand', 'Warranty Period']],
      body: tableData,
      theme: 'grid',
      headStyles: {
        fillColor: false,
        textColor: [0, 0, 0],
        font: 'times',
        fontStyle: 'bold',
        fontSize: 10,
        lineWidth: 0.2,
        lineColor: [0, 0, 0],
      },
      styles: {
        font: 'times',
        fontSize: 10,
        textColor: [0, 0, 0],
        cellPadding: 3,
        lineWidth: 0.2,
        lineColor: [0, 0, 0],
      },
      columnStyles: {
        0: { cellWidth: 76 },
        1: { cellWidth: 44 },
        2: { cellWidth: 45.1 },
      },
    });

    // @ts-expect-error autoTable adds lastAutoTable to doc
    cursorY = doc.lastAutoTable.finalY + 6.5;

    // Optional Note Below Table (if With Note is selected and has content)
    if (content.hasNote && content.noteText.trim()) {
      cursorY =
        renderRichParagraph(
          doc,
          splitStyledSpans(`Note: ${content.noteText}`, ['Note:']),
          marginX,
          cursorY,
          printableWidth,
          10,
          4.6
        ) + 3.0;
    }

    // Body Legal Paragraphs
    content.bodyParagraphs.forEach((paragraph, idx) => {
      if (!paragraph.trim()) return;
      const spacingAfter = idx === content.bodyParagraphs.length - 1 ? 3.5 : 2.6;
      cursorY =
        renderRichParagraph(
          doc,
          splitStyledSpans(paragraph, [KEVILTON_COMPANY_NAME]),
          marginX,
          cursorY,
          printableWidth,
          10,
          4.6
        ) + spacingAfter;
    });

    cursorY += 1;
    doc.setFont('times', 'normal');
    doc.setFontSize(10.5);
    if (content.thankYou.trim()) {
      doc.text(content.thankYou, marginX, cursorY);
      cursorY += 5.5;
    }

    doc.setFont('times', 'bold');
    if (content.closing.trim()) {
      doc.text(content.closing, marginX, cursorY);
      cursorY += 5.5;
    }

    if (content.closingCompany.trim()) {
      doc.text(content.closingCompany, marginX, cursorY);
      cursorY += 16;
    }

    // Clean text signature line (no rubber stamp, no signature image)
    doc.setFont('times', 'normal');
    doc.setFontSize(10);
    doc.text(content.signatureLine, marginX, cursorY);
    cursorY += 5;

    doc.setFont('times', 'bold');
    doc.text(content.signatoryTitle, marginX, cursorY);
    cursorY += 5;
    doc.text(content.signatoryCompany, marginX, cursorY);
  }

  return doc.output('blob');
}
