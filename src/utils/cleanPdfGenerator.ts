import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { WarrantyFormData, WarrantyTableRow } from '../types';
import { formatDateForCertificate, parseCustomerAddress, getCommonWarrantySubject } from './templateParser';

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

interface StyledSpan {
  text: string;
  bold?: boolean;
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

  // Tokenize into words while keeping styling
  const words: { text: string; bold: boolean; isSpace?: boolean }[] = [];
  for (const span of spans) {
    const isBold = !!span.bold;
    const parts = span.text.split(/(\s+)/);
    for (const part of parts) {
      if (!part) continue;
      if (/^\s+$/.test(part)) {
        words.push({ text: ' ', bold: isBold, isSpace: true });
      } else {
        words.push({ text: part, bold: isBold, isSpace: false });
      }
    }
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

  const isPoCertificate = formData.letterType === 'po_certificate';
  const parsedAddr = parseCustomerAddress(formData.customerAddress);
  const rows = getWarrantyRows(formData);
  const formattedDate = formatDateForCertificate(formData.date);

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
  doc.text(formattedDate || '', marginX, cursorY);
  cursorY += 9;

  // 2. Recipient Address Block (First line like Mr./Ms. [Customer Name] is bold)
  const addrLines = parsedAddr.formattedLines;
  for (let i = 0; i < addrLines.length; i++) {
    doc.setFont('times', i === 0 ? 'bold' : 'normal');
    doc.text(addrLines[i], marginX, cursorY);
    cursorY += 5.5;
  }
  cursorY += 4;

  if (isPoCertificate) {
    // ==========================================
    // 2. Common Warranty Certificate (PO Based)
    // Table Columns: 1. Product type | 2. Product Brand | 3. Warranty Period
    // ==========================================
    // Subject Line (Entire line bold)
    doc.setFont('times', 'bold');
    doc.setFontSize(11.5);
    const subjectText = getCommonWarrantySubject(formData.poNumber);
    const subjectLines = doc.splitTextToSize(subjectText, printableWidth);
    doc.text(subjectLines, marginX, cursorY);
    cursorY += subjectLines.length * 5.8 + 4;

    // Salutation (Bold in template)
    doc.setFont('times', 'bold');
    doc.setFontSize(11);
    doc.text('Dear Sir/Madam,', marginX, cursorY);
    cursorY += 7.5;

    // Opening Paragraph 1 (with "Kevilton Electrical Products (Pvt.) Ltd." bold)
    cursorY = renderRichParagraph(
      doc,
      [
        { text: 'We, ' },
        { text: 'Kevilton Electrical Products (Pvt.) Ltd.', bold: true },
        { text: ', sincerely appreciate the trust you have placed in our products. We are committed to providing high-quality products that comply with national and international standards.' },
      ],
      marginX,
      cursorY,
      printableWidth,
      10.5,
      5.2
    ) + 3.5;

    // Opening Paragraph 2 (with Purchase Order number bold)
    const poNumText = formData.poNumber?.trim() || '[PO Number]';
    cursorY = renderRichParagraph(
      doc,
      [
        { text: 'We hereby confirm that the following products supplied against Purchase Order No. ' },
        { text: poNumText, bold: true },
        { text: ' are covered under the Kevilton warranty program.' },
      ],
      marginX,
      cursorY,
      printableWidth,
      10.5,
      5.2
    ) + 4;

    // Section header (Bold in template)
    doc.setFont('times', 'bold');
    doc.setFontSize(10.5);
    doc.text('Items Covered Under This Warranty:', marginX, cursorY);
    cursorY += 4.5;

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

    // Note & Disclaimers
    cursorY = renderRichParagraph(
      doc,
      [
        { text: 'Note: ', bold: true },
        { text: 'The above warranty covers manufacturing defects under normal installation and operating conditions from the date of purchase.' },
      ],
      marginX,
      cursorY,
      printableWidth,
      10.5,
      5.0
    ) + 3;

    const discP =
      'This warranty does not cover defects or damage resulting from improper installation, misuse, accidents, unauthorized modifications, negligence, or external causes. Proof of purchase and relevant product identification details are required for any warranty claim.';
    const discLines = doc.splitTextToSize(discP, printableWidth);
    doc.text(discLines, marginX, cursorY);
    cursorY += discLines.length * 5.0 + 3;

    const contP =
      'Should you require any further information regarding this warranty, please do not hesitate to contact us.';
    const contLines = doc.splitTextToSize(contP, printableWidth);
    doc.text(contLines, marginX, cursorY);
    cursorY += contLines.length * 5.0 + 4;

    doc.text('Thank you.', marginX, cursorY);
    cursorY += 6.5;

    doc.text('Yours faithfully,', marginX, cursorY);
    cursorY += 16;

    // Clean text signature line (no rubber stamp, no signature image)
    doc.setFont('times', 'normal');
    doc.setFontSize(10);
    doc.text('……………………..', marginX, cursorY);
    cursorY += 5;

    doc.setFont('times', 'bold');
    doc.text('Manager – Quality Assurance', marginX, cursorY);
    cursorY += 5;
    doc.text('Kevilton Electrical Products (Pvt.) Ltd.', marginX, cursorY);

  } else {
    // ==========================================
    // 1. Common Draft Warranty Certificate (Declaration)
    // Table Columns: 1. Item Code | 2. Description | 3. Warranty Period
    // ==========================================

    // Salutation (Bold in template)
    doc.setFont('times', 'bold');
    doc.setFontSize(11);
    doc.text('Dear Sir/Madam,', marginX, cursorY);
    cursorY += 8;

    // Heading: Warranty Declaration for [Product Brand] (Bold in template)
    const brandSubject = getProductBrandSubject(rows);
    doc.setFont('times', 'bold');
    doc.setFontSize(11.5);
    const titleText = `Warranty Declaration for ${brandSubject}`;
    const titleLines = doc.splitTextToSize(titleText, printableWidth);
    doc.text(titleLines, marginX, cursorY);
    cursorY += titleLines.length * 5.5 + 4;

    // Paragraph 1 (with company name and Kevilton bold)
    const company = parsedAddr.companyName || '[Company Name]';
    cursorY = renderRichParagraph(
      doc,
      [
        { text: 'With reference to the product supplied to ' },
        { text: company, bold: true },
        { text: ', we hereby confirm that ' },
        { text: 'Kevilton Electrical Products (Pvt.) Ltd.', bold: true },
        { text: ' provides the following warranty for the product detailed below:' },
      ],
      marginX,
      cursorY,
      printableWidth,
      10.5,
      5.0
    ) + 3.5;

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

    // Body Legal Paragraphs exactly as sample
    // Clause 1
    cursorY = renderRichParagraph(
      doc,
      [{ text: 'The above warranty covers manufacturing defects arising under normal installation and operating conditions from the date of delivery.' }],
      marginX,
      cursorY,
      printableWidth,
      10,
      4.6
    ) + 2.6;

    // Clause 2 (with Kevilton bold)
    cursorY = renderRichParagraph(
      doc,
      [
        { text: 'During the warranty period, ' },
        { text: 'Kevilton Electrical Products (Pvt.) Ltd.', bold: true },
        { text: ' will, at its discretion, repair or replace any product found to be defective due to manufacturing faults.' },
      ],
      marginX,
      cursorY,
      printableWidth,
      10,
      4.6
    ) + 2.6;

    // Clause 3
    cursorY = renderRichParagraph(
      doc,
      [{ text: 'This warranty does not cover defects or damage resulting from improper installation, misuse, accidents, unauthorized modification, negligence, incorrect handling, external causes, or normal wear and tear. Proof of purchase and relevant product identification details may be required for any warranty claim.' }],
      marginX,
      cursorY,
      printableWidth,
      10,
      4.6
    ) + 2.6;

    // Clause 4 (with Kevilton bold)
    cursorY = renderRichParagraph(
      doc,
      [
        { text: 'The decision of ' },
        { text: 'Kevilton Electrical Products (Pvt.) Ltd.', bold: true },
        { text: ' shall be final regarding any warranty claim or dispute that may arise. This letter is issued upon request as a warranty reference for the above-mentioned product.' },
      ],
      marginX,
      cursorY,
      printableWidth,
      10,
      4.6
    ) + 2.6;

    // Clause 5
    cursorY = renderRichParagraph(
      doc,
      [{ text: 'Should you require any further information regarding this warranty, please do not hesitate to contact us.' }],
      marginX,
      cursorY,
      printableWidth,
      10,
      4.6
    ) + 3.5;

    cursorY += 1;
    doc.setFont('times', 'normal');
    doc.setFontSize(10.5);
    doc.text('Thank you.', marginX, cursorY);
    cursorY += 5.5;

    doc.setFont('times', 'bold');
    doc.text('Yours Faithfully,', marginX, cursorY);
    cursorY += 5.5;

    doc.text('Kevilton Electrical Products (Pvt.) Ltd.', marginX, cursorY);
    cursorY += 16;

    // Clean text signature line (no rubber stamp, no signature image)
    doc.setFont('times', 'normal');
    doc.setFontSize(10);
    doc.text('.............................................', marginX, cursorY);
    cursorY += 5;

    doc.setFont('times', 'bold');
    doc.text('Manager – Quality Assurance', marginX, cursorY);
    cursorY += 5;
    doc.text('Kevilton Electrical Products (Pvt.) Ltd.', marginX, cursorY);
  }

  return doc.output('blob');
}
