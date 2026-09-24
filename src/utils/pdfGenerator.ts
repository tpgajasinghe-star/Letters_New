import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { WarrantyFormData } from '../types';
import { formatDateForCertificate, parseCustomerAddress, parseItemSupplied } from './templateParser';

/**
 * Creates an offscreen canvas with the Kevilton logo and returns it as a data URL.
 */
function createKeviltonLogoDataUrl(): string {
  const canvas = document.createElement('canvas');
  canvas.width = 600;
  canvas.height = 140;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  // Background is transparent
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Draw lightning bolt symbol
  ctx.fillStyle = '#EAB308'; // Amber yellow
  ctx.beginPath();
  ctx.moveTo(35, 10);
  ctx.lineTo(8, 75);
  ctx.lineTo(32, 75);
  ctx.lineTo(15, 125);
  ctx.lineTo(52, 55);
  ctx.lineTo(30, 55);
  ctx.closePath();
  ctx.fill();

  // Draw KEVILTON text
  ctx.fillStyle = '#08407B'; // Official navy
  ctx.font = 'italic 900 68px "Arial", sans-serif';
  ctx.fillText('KEVILTON', 60, 75);

  // Subtitle
  ctx.fillStyle = '#08407B';
  ctx.font = 'bold 22px "Arial", sans-serif';
  ctx.fillText('Electrical Products (Pvt.) Ltd.', 62, 110);

  return canvas.toDataURL('image/png');
}

/**
 * Creates an offscreen canvas with an authentic Manager - QA signature & official blue stamp
 */
function createSignatureStampDataUrl(): string {
  const canvas = document.createElement('canvas');
  canvas.width = 450;
  canvas.height = 200;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Official Seal Stamp (circular border with text in blue ink)
  ctx.save();
  ctx.translate(140, 100);
  ctx.rotate(-0.06); // subtle realistic tilt

  // Outer double circle
  ctx.strokeStyle = 'rgba(16, 75, 155, 0.75)';
  ctx.lineWidth = 3.5;
  ctx.beginPath();
  ctx.arc(0, 0, 72, 0, Math.PI * 2);
  ctx.stroke();

  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(0, 0, 64, 0, Math.PI * 2);
  ctx.stroke();

  // Stamp center text
  ctx.fillStyle = 'rgba(16, 75, 155, 0.85)';
  ctx.font = 'bold 13px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('KEVILTON ELECTRICAL', 0, -32);
  ctx.font = 'bold 15px sans-serif';
  ctx.fillText('QUALITY ASSURANCE', 0, -10);
  ctx.font = '900 18px sans-serif';
  ctx.fillText('★ APPROVED ★', 0, 16);
  ctx.font = 'bold 11px sans-serif';
  ctx.fillText('CERTIFIED WARRANTY', 0, 38);
  ctx.restore();

  // Manager's cursive signature over the line
  ctx.save();
  ctx.strokeStyle = '#0F2C59'; // Blue-black pen ink
  ctx.lineWidth = 2.4;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  ctx.beginPath();
  // Flowing signature loop
  ctx.moveTo(220, 120);
  ctx.bezierCurveTo(240, 60, 270, 70, 285, 110);
  ctx.bezierCurveTo(295, 130, 310, 80, 335, 100);
  ctx.bezierCurveTo(350, 115, 370, 75, 390, 110);
  ctx.bezierCurveTo(400, 125, 415, 95, 430, 105);

  // Underline flourish
  ctx.moveTo(215, 128);
  ctx.quadraticCurveTo(320, 140, 440, 122);
  ctx.stroke();
  ctx.restore();

  return canvas.toDataURL('image/png');
}

export async function generateWarrantyPdf(formData: WarrantyFormData): Promise<Blob> {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const parsedAddr = parseCustomerAddress(formData.customerAddress);
  const rows = parseItemSupplied(formData.itemSupplied || '');
  const formattedDate = formatDateForCertificate(formData.date);
  const isPoCertificate = formData.templateType === 'po_certificate';
  const isDraft = formData.certificateKind === 'draft';

  // If Draft mode, draw semi-transparent DRAFT watermark across the page
  if (isDraft) {
    doc.saveGraphicsState();
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(60);
    doc.setTextColor(210, 215, 225);
    // Draw rotated text in center
    doc.text('DRAFT COPY', 105, 150, {
      align: 'center',
      angle: 45,
    });
    doc.restoreGraphicsState();
  }

  const marginX = 22;
  let cursorY = 18;

  // Add Kevilton Letterhead Logo
  try {
    const logoData = createKeviltonLogoDataUrl();
    if (logoData) {
      doc.addImage(logoData, 'PNG', marginX, cursorY, 78, 18.2);
    }
  } catch (err) {
    console.warn('Could not add logo image:', err);
    doc.setFont('times', 'bold');
    doc.setFontSize(22);
    doc.setTextColor(8, 64, 123);
    doc.text('KEVILTON', marginX, cursorY + 10);
    doc.setFontSize(10);
    doc.text('Electrical Products (Pvt.) Ltd.', marginX, cursorY + 16);
  }

  // Top header rule / divider
  cursorY += 24;
  doc.setDrawColor(8, 64, 123);
  doc.setLineWidth(0.8);
  doc.line(marginX, cursorY, 210 - marginX, cursorY);
  doc.setDrawColor(200, 200, 200);
  doc.setLineWidth(0.3);
  doc.line(marginX, cursorY + 1.2, 210 - marginX, cursorY + 1.2);

  cursorY += 10;

  // Date line
  doc.setFont('times', 'normal');
  doc.setFontSize(11);
  doc.setTextColor(20, 20, 20);
  doc.text(`Date: ${formattedDate || '[Date]'}`, marginX, cursorY);
  cursorY += 8;

  // Recipient block
  doc.setFont('times', 'normal');
  doc.setFontSize(11);
  doc.setTextColor(20, 20, 20);

  if (isPoCertificate) {
    // Template 2 address style
    const addrLines = parsedAddr.formattedLines;
    for (const line of addrLines) {
      doc.text(line, marginX, cursorY);
      cursorY += 5.5;
    }
  } else {
    // Template 1 address style
    const addrLines = parsedAddr.formattedLines;
    for (const line of addrLines) {
      doc.text(line, marginX, cursorY);
      cursorY += 5.5;
    }
  }

  cursorY += 4;

  if (isPoCertificate) {
    // Template 2: Subject Line
    const poNum = formData.poNumber || 'PO-2026-089';
    doc.setFont('times', 'bold');
    doc.text(`Subject: Warranty Certificate for Kevilton Products Supplied Against PO ${poNum}`, marginX, cursorY);
    cursorY += 7;

    doc.setFont('times', 'normal');
    doc.text('Dear Sir/Madam,', marginX, cursorY);
    cursorY += 7;

    // Opening Paragraph 1
    const p1 = 'We, Kevilton Electrical Products (Pvt.) Ltd., sincerely appreciate the trust you have placed in our products. We are committed to providing high-quality products that comply with national and international standards.';
    const p1Lines = doc.splitTextToSize(p1, 210 - marginX * 2);
    doc.text(p1Lines, marginX, cursorY);
    cursorY += p1Lines.length * 5.2 + 3;

    // Opening Paragraph 2
    const p2 = `We hereby confirm that the following products supplied against Purchase Order No. ${poNum} are covered under the Kevilton warranty program.`;
    const p2Lines = doc.splitTextToSize(p2, 210 - marginX * 2);
    doc.text(p2Lines, marginX, cursorY);
    cursorY += p2Lines.length * 5.2 + 4;

    doc.setFont('times', 'bold');
    doc.text('Items Covered Under This Warranty:', marginX, cursorY);
    cursorY += 4;

    // Table for Template 2
    const tableData = rows.map((r) => [r.description, r.productBrand || 'Kevilton', r.warrantyPeriod]);

    autoTable(doc, {
      startY: cursorY,
      margin: { left: marginX, right: marginX },
      head: [['Product type', 'Product Brand', 'Warranty Period']],
      body: tableData,
      theme: 'grid',
      headStyles: {
        fillColor: [245, 245, 245],
        textColor: [20, 20, 20],
        font: 'times',
        fontStyle: 'bold',
        fontSize: 10,
        lineWidth: 0.2,
        lineColor: [40, 40, 40],
      },
      styles: {
        font: 'times',
        fontSize: 9.5,
        textColor: [20, 20, 20],
        cellPadding: 3,
        lineWidth: 0.2,
        lineColor: [60, 60, 60],
      },
      columnStyles: {
        0: { cellWidth: 70 },
        1: { cellWidth: 50 },
        2: { cellWidth: 46 },
      },
    });

    // @ts-expect-error autoTable adds lastAutoTable to doc
    cursorY = doc.lastAutoTable.finalY + 6;

    // Note paragraph
    doc.setFont('times', 'normal');
    doc.setFontSize(10.5);
    const noteP = 'Note: The above warranty covers manufacturing defects under normal installation and operating conditions from the date of purchase.';
    const noteLines = doc.splitTextToSize(noteP, 210 - marginX * 2);
    doc.text(noteLines, marginX, cursorY);
    cursorY += noteLines.length * 5 + 3;

    // Disclaimer paragraph
    const discP = 'This warranty does not cover defects or damage resulting from improper installation, misuse, accidents, unauthorized modifications, negligence, or external causes. Proof of purchase and relevant product identification details are required for any warranty claim.';
    const discLines = doc.splitTextToSize(discP, 210 - marginX * 2);
    doc.text(discLines, marginX, cursorY);
    cursorY += discLines.length * 5 + 3;

    // Contact paragraph
    const contP = 'Should you require any further information regarding this warranty, please do not hesitate to contact us.';
    const contLines = doc.splitTextToSize(contP, 210 - marginX * 2);
    doc.text(contLines, marginX, cursorY);
    cursorY += contLines.length * 5 + 3;

    doc.text('Thank you.', marginX, cursorY);
    cursorY += 6;
    doc.text('Yours faithfully,', marginX, cursorY);
    cursorY += 5;

  } else {
    // Template 1: Primary Standard Template
    doc.setFont('times', 'normal');
    doc.text('Dear Sir/Madam,', marginX, cursorY);
    cursorY += 8;

    // Title: Warranty Declaration for [Product Description]
    const primaryProdDesc = rows[0]?.description || '[Product Description]';
    doc.setFont('times', 'bold');
    doc.setFontSize(11.5);
    doc.text(`Warranty Declaration for ${primaryProdDesc}`, marginX, cursorY);
    cursorY += 7;

    // Paragraph 1
    doc.setFont('times', 'normal');
    doc.setFontSize(10.5);
    const company = parsedAddr.companyName || '[Company Name]';
    const introP = `With reference to the product supplied to ${company}, we hereby confirm that Kevilton Electrical Products (Pvt.) Ltd. provides the following warranty for the product detailed below:`;
    const introLines = doc.splitTextToSize(introP, 210 - marginX * 2);
    doc.text(introLines, marginX, cursorY);
    cursorY += introLines.length * 5 + 3;

    // Table
    const tableData = rows.map((r) => [r.itemCode, r.description, r.warrantyPeriod]);

    autoTable(doc, {
      startY: cursorY,
      margin: { left: marginX, right: marginX },
      head: [['Item Code', 'Description', 'Warranty Period']],
      body: tableData,
      theme: 'grid',
      headStyles: {
        fillColor: [248, 248, 248],
        textColor: [20, 20, 20],
        font: 'times',
        fontStyle: 'bold',
        fontSize: 10,
        lineWidth: 0.2,
        lineColor: [40, 40, 40],
      },
      styles: {
        font: 'times',
        fontSize: 9.5,
        textColor: [20, 20, 20],
        cellPadding: 3,
        lineWidth: 0.2,
        lineColor: [60, 60, 60],
      },
      columnStyles: {
        0: { cellWidth: 45 },
        1: { cellWidth: 75 },
        2: { cellWidth: 46 },
      },
    });

    // @ts-expect-error autoTable adds lastAutoTable to doc
    cursorY = doc.lastAutoTable.finalY + 6;

    // Body Paragraphs exactly as in source template
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
      const pLines = doc.splitTextToSize(paragraph, 210 - marginX * 2);
      doc.text(pLines, marginX, cursorY);
      cursorY += pLines.length * 4.6 + 2.8;
    }

    doc.text('Thank you.', marginX, cursorY);
    cursorY += 5.5;

    doc.setFont('times', 'bold');
    doc.text('Yours Faithfully,', marginX, cursorY);
    cursorY += 5.5;

    doc.setFont('times', 'bold');
    doc.text('Kevilton Electrical Products (Pvt.) Ltd.', marginX, cursorY);
    cursorY += 3;
  }

  // Signature and Official Stamp
  try {
    const stampData = createSignatureStampDataUrl();
    if (stampData) {
      doc.addImage(stampData, 'PNG', marginX + 15, cursorY - 6, 68, 30);
    }
  } catch (err) {
    console.warn('Could not add signature image:', err);
  }

  cursorY += 20;

  // Signature line and Manager QA block
  doc.setFont('times', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(60, 60, 60);
  doc.text('...........................................................................', marginX, cursorY);
  cursorY += 4.5;

  doc.setFont('times', 'bold');
  doc.setTextColor(20, 20, 20);
  doc.text('Manager – Quality Assurance', marginX, cursorY);
  cursorY += 4.5;
  doc.text('Kevilton Electrical Products (Pvt.) Ltd.', marginX, cursorY);

  // Return generated PDF Blob
  return doc.output('blob');
}
