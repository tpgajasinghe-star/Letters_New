import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { WarrantyFormData, WarrantyTableRow } from '../types';
import { formatDateForCertificate, parseCustomerAddress } from './templateParser';

/**
 * Extracts rows from structured items or fallback
 */
export function getWarrantyRows(formData: WarrantyFormData): WarrantyTableRow[] {
  if (formData.items && formData.items.length > 0) {
    return formData.items.map((item, idx) => ({
      itemCode: item.itemCode?.trim() || `ITEM-${idx + 1}`,
      description: item.description?.trim() || item.productType?.trim() || 'Electrical Item',
      warrantyPeriod: item.warrantyPeriod?.trim() || '1 Year',
      productType: item.productType?.trim() || item.description?.trim() || 'Electrical Item',
      productBrand: item.productBrand?.trim() || 'Kevilton',
    }));
  }

  return [
    {
      itemCode: 'KEV-101',
      description: 'Switches and Sockets',
      warrantyPeriod: '5 Years',
      productType: 'Switches and Sockets',
      productBrand: 'Kevilton',
    },
  ];
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

  // 1. Date
  doc.setFont('times', 'normal');
  doc.setFontSize(11);
  doc.setTextColor(0, 0, 0);
  doc.text(`Date: ${formattedDate || ''}`, marginX, cursorY);
  cursorY += 9;

  // 2. Recipient Address Block
  const addrLines = parsedAddr.formattedLines;
  for (const line of addrLines) {
    doc.text(line, marginX, cursorY);
    cursorY += 5.5;
  }
  cursorY += 4;

  if (isPoCertificate) {
    // ==========================================
    // 2. Common Warranty Certificate (PO Based)
    // Table Columns: 1. Product type | 2. Product Brand | 3. Warranty Period
    // ==========================================
    // Subject Line
    doc.setFont('times', 'bold');
    doc.setFontSize(11.5);
    const subjectText = 'Subject: Warranty Certificate for Kevilton Products Supplied';
    const subjectLines = doc.splitTextToSize(subjectText, printableWidth);
    doc.text(subjectLines, marginX, cursorY);
    cursorY += subjectLines.length * 5.8 + 4;

    // Salutation
    doc.setFont('times', 'normal');
    doc.setFontSize(11);
    doc.text('Dear Sir/Madam,', marginX, cursorY);
    cursorY += 7.5;

    // Opening Paragraph 1
    const p1 =
      'We, Kevilton Electrical Products (Pvt.) Ltd., sincerely appreciate the trust you have placed in our products. We are committed to providing high-quality products that comply with national and international standards.';
    const p1Lines = doc.splitTextToSize(p1, printableWidth);
    doc.text(p1Lines, marginX, cursorY);
    cursorY += p1Lines.length * 5.2 + 3.5;

    // Opening Paragraph 2
    const p2 = 'We hereby confirm that the following products supplied are covered under the Kevilton warranty program.';
    const p2Lines = doc.splitTextToSize(p2, printableWidth);
    doc.text(p2Lines, marginX, cursorY);
    cursorY += p2Lines.length * 5.2 + 4;

    // Section header
    doc.setFont('times', 'bold');
    doc.text('Items Covered Under This Warranty:', marginX, cursorY);
    cursorY += 4.5;

    // Table: 1. Product type | 2. Product Brand | 3. Warranty Period (Plain white header, no shading)
    const tableData = rows.map((r) => [
      r.productType || r.description,
      r.productBrand || 'Kevilton',
      r.warrantyPeriod,
    ]);

    autoTable(doc, {
      startY: cursorY,
      margin: { left: marginX, right: marginX, top: marginY, bottom: marginY },
      head: [['Product type', 'Product Brand', 'Warranty Period']],
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
        0: { cellWidth: 72 },
        1: { cellWidth: 46 },
        2: { cellWidth: 47.1 },
      },
    });

    // @ts-expect-error autoTable adds lastAutoTable to doc
    cursorY = doc.lastAutoTable.finalY + 6.5;

    // Note & Disclaimers
    doc.setFont('times', 'normal');
    doc.setFontSize(10.5);

    const noteP =
      'Note: The above warranty covers manufacturing defects under normal installation and operating conditions from the date of purchase.';
    const noteLines = doc.splitTextToSize(noteP, printableWidth);
    doc.text(noteLines, marginX, cursorY);
    cursorY += noteLines.length * 5.0 + 3;

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
    cursorY += 5.5;

    doc.setFont('times', 'bold');
    doc.text('Kevilton Electrical Products (Pvt.) Ltd.', marginX, cursorY);
    cursorY += 16;

    // Clean text signature line (no rubber stamp, no signature image)
    doc.setFont('times', 'normal');
    doc.setFontSize(10);
    doc.text('...........................................................................', marginX, cursorY);
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

    // Salutation
    doc.setFont('times', 'normal');
    doc.setFontSize(11);
    doc.text('Dear Sir/Madam,', marginX, cursorY);
    cursorY += 8;

    // Heading: Warranty Declaration for [Product]
    const primaryProdDesc = rows[0]?.description || rows[0]?.productType || '[Product Description]';
    doc.setFont('times', 'bold');
    doc.setFontSize(11.5);
    const titleText = `Warranty Declaration for ${primaryProdDesc}`;
    const titleLines = doc.splitTextToSize(titleText, printableWidth);
    doc.text(titleLines, marginX, cursorY);
    cursorY += titleLines.length * 5.5 + 4;

    // Paragraph 1
    doc.setFont('times', 'normal');
    doc.setFontSize(10.5);
    const company = parsedAddr.companyName || '[Company Name]';
    const introP = `With reference to the product supplied to ${company}, we hereby confirm that Kevilton Electrical Products (Pvt.) Ltd. provides the following warranty for the product detailed below:`;
    const introLines = doc.splitTextToSize(introP, printableWidth);
    doc.text(introLines, marginX, cursorY);
    cursorY += introLines.length * 5.0 + 3.5;

    // Table: 1. Item Code | 2. Description | 3. Warranty Period (Plain white header, no shading)
    const tableData = rows.map((r) => [r.itemCode, r.description, r.warrantyPeriod]);

    autoTable(doc, {
      startY: cursorY,
      margin: { left: marginX, right: marginX, top: marginY, bottom: marginY },
      head: [['Item Code', 'Description', 'Warranty Period']],
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
        0: { cellWidth: 44 },
        1: { cellWidth: 76 },
        2: { cellWidth: 45.1 },
      },
    });

    // @ts-expect-error autoTable adds lastAutoTable to doc
    cursorY = doc.lastAutoTable.finalY + 6.5;

    // Body Legal Paragraphs exactly as sample
    const bodyParagraphs = [
      'The above warranty covers manufacturing defects arising under normal installation and operating conditions from the date of delivery.',
      'During the warranty period, Kevilton Electrical Products (Pvt.) Ltd. will, at its discretion, repair or replace any product found to be defective due to manufacturing faults.',
      'This warranty does not cover defects or damage resulting from improper installation, misuse, accidents, unauthorized modification, negligence, incorrect handling, external causes, or normal wear and tear. Proof of purchase and relevant product identification details may be required for any warranty claim.',
      'The decision of Kevilton Electrical Products (Pvt.) Ltd. shall be final regarding any warranty claim or dispute that may arise. This letter is issued upon request as a warranty reference for the above-mentioned product.',
      'Should you require any further information regarding this warranty, please do not hesitate to contact us.',
    ];

    doc.setFont('times', 'normal');
    doc.setFontSize(10);
    for (const paragraph of bodyParagraphs) {
      const pLines = doc.splitTextToSize(paragraph, printableWidth);
      doc.text(pLines, marginX, cursorY);
      cursorY += pLines.length * 4.6 + 2.6;
    }

    cursorY += 2;
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
    doc.text('...........................................................................', marginX, cursorY);
    cursorY += 5;

    doc.setFont('times', 'bold');
    doc.text('Manager – Quality Assurance', marginX, cursorY);
    cursorY += 5;
    doc.text('Kevilton Electrical Products (Pvt.) Ltd.', marginX, cursorY);
  }

  return doc.output('blob');
}
