import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  WidthType,
  BorderStyle,
} from 'docx';
import { WarrantyFormData } from '../types';
import { formatDateForCertificate, parseCustomerAddress, getCommonWarrantySubject } from './templateParser';
import { getWarrantyRows, getProductBrandSubject } from './cleanPdfGenerator';

/**
 * Generates an editable Microsoft Word (.docx) document strictly without
 * header, logo, watermark, rubber seal, or signature image.
 * Uses exact Times New Roman font, standard 1-inch margins, and cleanly formatted tables (no shading).
 */
export async function generateCleanWarrantyDocx(formData: WarrantyFormData): Promise<Blob> {
  const isPoCertificate = formData.letterType === 'po_certificate';
  const parsedAddr = parseCustomerAddress(formData.customerAddress);
  const rows = getWarrantyRows(formData);
  const formattedDate = formatDateForCertificate(formData.date);

  const docChildren: (Paragraph | Table)[] = [];

  // 1. Date (Bold in template)
  docChildren.push(
    new Paragraph({
      spacing: { after: 240 },
      children: [
        new TextRun({
          text: formattedDate || '',
          font: 'Times New Roman',
          size: 22, // 11pt
          bold: true,
        }),
      ],
    })
  );

  // 2. Recipient Address Lines (First line like Mr./Ms. [Customer Name] is bold)
  for (let i = 0; i < parsedAddr.formattedLines.length; i++) {
    docChildren.push(
      new Paragraph({
        spacing: { after: 80 },
        children: [
          new TextRun({
            text: parsedAddr.formattedLines[i],
            font: 'Times New Roman',
            size: 22,
            bold: i === 0,
          }),
        ],
      })
    );
  }

  // Blank spacing
  docChildren.push(new Paragraph({ spacing: { after: 180 } }));

  if (isPoCertificate) {
    // TEMPLATE 2: Common Warranty Certificate
    // Columns: Product type | Product Brand | Warranty Period

    // Subject line (Without "Subject:" and with PO number at the end - Entire line bold)
    const subjectText = getCommonWarrantySubject(formData.poNumber);
    docChildren.push(
      new Paragraph({
        spacing: { after: 220 },
        children: [
          new TextRun({
            text: subjectText,
            font: 'Times New Roman',
            size: 23, // 11.5pt
            bold: true,
          }),
        ],
      })
    );

    // Salutation (Bold in template)
    docChildren.push(
      new Paragraph({
        spacing: { after: 180 },
        children: [
          new TextRun({
            text: 'Dear Sir/Madam,',
            font: 'Times New Roman',
            size: 22,
            bold: true,
          }),
        ],
      })
    );

    // Paragraph 1 (with Kevilton bold)
    docChildren.push(
      new Paragraph({
        spacing: { after: 160 },
        children: [
          new TextRun({
            text: 'We, ',
            font: 'Times New Roman',
            size: 21, // 10.5pt
          }),
          new TextRun({
            text: 'Kevilton Electrical Products (Pvt.) Ltd.',
            font: 'Times New Roman',
            size: 21,
            bold: true,
          }),
          new TextRun({
            text: ', sincerely appreciate the trust you have placed in our products. We are committed to providing high-quality products that comply with national and international standards.',
            font: 'Times New Roman',
            size: 21,
          }),
        ],
      })
    );

    // Paragraph 2 (with Purchase Order number bold)
    const poNumText = formData.poNumber?.trim() || '[PO Number]';
    docChildren.push(
      new Paragraph({
        spacing: { after: 180 },
        children: [
          new TextRun({
            text: 'We hereby confirm that the following products supplied against Purchase Order No. ',
            font: 'Times New Roman',
            size: 21,
          }),
          new TextRun({
            text: poNumText,
            font: 'Times New Roman',
            size: 21,
            bold: true,
          }),
          new TextRun({
            text: ' are covered under the Kevilton warranty program.',
            font: 'Times New Roman',
            size: 21,
          }),
        ],
      })
    );

    // Section header (Bold in template)
    docChildren.push(
      new Paragraph({
        spacing: { after: 140 },
        children: [
          new TextRun({
            text: 'Items Covered Under This Warranty:',
            font: 'Times New Roman',
            size: 21,
            bold: true,
          }),
        ],
      })
    );

    // Table: Product Description | Product Brand | Warranty Period (No shading)
    const tableHeader = new TableRow({
      tableHeader: true,
      children: [
        createTableCell('Product Description', true, 4560),
        createTableCell('Product Brand', true, 2400),
        createTableCell('Warranty Period', true, 2400),
      ],
    });

    const tableRows = rows.map((r) =>
      new TableRow({
        children: [
          createTableCell(r.description, false, 4560),
          createTableCell(r.productBrand || 'Wiring Devices', false, 2400),
          createTableCell(r.warrantyPeriod, false, 2400),
        ],
      })
    );

    docChildren.push(
      new Table({
        width: { size: 9360, type: WidthType.DXA },
        rows: [tableHeader, ...tableRows],
      })
    );

    docChildren.push(new Paragraph({ spacing: { after: 200 } }));

    // Note with "Note: " bold
    docChildren.push(
      new Paragraph({
        spacing: { after: 140 },
        children: [
          new TextRun({
            text: 'Note: ',
            font: 'Times New Roman',
            size: 20,
            bold: true,
          }),
          new TextRun({
            text: 'The above warranty covers manufacturing defects under normal installation and operating conditions from the date of purchase.',
            font: 'Times New Roman',
            size: 20,
          }),
        ],
      })
    );

    // Disclaimers
    docChildren.push(
      new Paragraph({
        spacing: { after: 140 },
        children: [
          new TextRun({
            text: 'This warranty does not cover defects or damage resulting from improper installation, misuse, accidents, unauthorized modifications, negligence, or external causes. Proof of purchase and relevant product identification details are required for any warranty claim.',
            font: 'Times New Roman',
            size: 20,
          }),
        ],
      })
    );

    docChildren.push(
      new Paragraph({
        spacing: { after: 140 },
        children: [
          new TextRun({
            text: 'Should you require any further information regarding this warranty, please do not hesitate to contact us.',
            font: 'Times New Roman',
            size: 20,
          }),
        ],
      })
    );

    docChildren.push(
      new Paragraph({
        spacing: { after: 120 },
        children: [new TextRun({ text: 'Thank you.', font: 'Times New Roman', size: 21 })],
      })
    );
    docChildren.push(
      new Paragraph({
        spacing: { after: 500 },
        children: [new TextRun({ text: 'Yours faithfully,', font: 'Times New Roman', size: 21 })],
      })
    );

    // Signature text line
    docChildren.push(
      new Paragraph({
        spacing: { after: 80 },
        children: [
          new TextRun({
            text: '……………………..',
            font: 'Times New Roman',
            size: 20,
          }),
        ],
      })
    );
    docChildren.push(
      new Paragraph({
        spacing: { after: 60 },
        children: [
          new TextRun({
            text: 'Manager – Quality Assurance',
            font: 'Times New Roman',
            size: 20,
            bold: true,
          }),
        ],
      })
    );
    docChildren.push(
      new Paragraph({
        spacing: { after: 60 },
        children: [
          new TextRun({
            text: 'Kevilton Electrical Products (Pvt.) Ltd.',
            font: 'Times New Roman',
            size: 20,
          }),
        ],
      })
    );
  } else {
    // TEMPLATE 1: Common Draft Warranty Certificate (Declaration)
    // Columns: Item Code | Description | Warranty Period
    // Salutation (Bold in template)
    docChildren.push(
      new Paragraph({
        spacing: { after: 200 },
        children: [
          new TextRun({
            text: 'Dear Sir/Madam,',
            font: 'Times New Roman',
            size: 22,
            bold: true,
          }),
        ],
      })
    );

    // Title: Warranty Declaration for [Product Brand]
    const brandSubject = getProductBrandSubject(rows);
    docChildren.push(
      new Paragraph({
        spacing: { after: 180 },
        children: [
          new TextRun({
            text: `Warranty Declaration for ${brandSubject}`,
            font: 'Times New Roman',
            size: 23,
            bold: true,
          }),
        ],
      })
    );

    // Opening Paragraph (with company name and Kevilton bold)
    const company = parsedAddr.companyName || '[Company Name]';
    docChildren.push(
      new Paragraph({
        spacing: { after: 180 },
        children: [
          new TextRun({
            text: 'With reference to the product supplied to ',
            font: 'Times New Roman',
            size: 21,
          }),
          new TextRun({
            text: company,
            font: 'Times New Roman',
            size: 21,
            bold: true,
          }),
          new TextRun({
            text: ', we hereby confirm that ',
            font: 'Times New Roman',
            size: 21,
          }),
          new TextRun({
            text: 'Kevilton Electrical Products (Pvt.) Ltd.',
            font: 'Times New Roman',
            size: 21,
            bold: true,
          }),
          new TextRun({
            text: ' provides the following warranty for the product detailed below:',
            font: 'Times New Roman',
            size: 21,
          }),
        ],
      })
    );

    // Table: Product Description | Product Brand | Warranty Period (No shading)
    const tableHeader = new TableRow({
      tableHeader: true,
      children: [
        createTableCell('Product Description', true, 4560),
        createTableCell('Product Brand', true, 2400),
        createTableCell('Warranty Period', true, 2400),
      ],
    });

    const tableRows = rows.map((r) =>
      new TableRow({
        children: [
          createTableCell(r.description, false, 4560),
          createTableCell(r.productBrand || 'Wiring Devices', false, 2400),
          createTableCell(r.warrantyPeriod, false, 2400),
        ],
      })
    );

    docChildren.push(
      new Table({
        width: { size: 9360, type: WidthType.DXA },
        rows: [tableHeader, ...tableRows],
      })
    );

    docChildren.push(new Paragraph({ spacing: { after: 200 } }));

    // Body Paragraphs (Clauses 2 and 4 have Kevilton in bold)
    // Clause 1
    docChildren.push(
      new Paragraph({
        spacing: { after: 140 },
        children: [
          new TextRun({
            text: 'The above warranty covers manufacturing defects arising under normal installation and operating conditions from the date of delivery.',
            font: 'Times New Roman',
            size: 20,
          }),
        ],
      })
    );

    // Clause 2
    docChildren.push(
      new Paragraph({
        spacing: { after: 140 },
        children: [
          new TextRun({
            text: 'During the warranty period, ',
            font: 'Times New Roman',
            size: 20,
          }),
          new TextRun({
            text: 'Kevilton Electrical Products (Pvt.) Ltd.',
            font: 'Times New Roman',
            size: 20,
            bold: true,
          }),
          new TextRun({
            text: ' will, at its discretion, repair or replace any product found to be defective due to manufacturing faults.',
            font: 'Times New Roman',
            size: 20,
          }),
        ],
      })
    );

    // Clause 3
    docChildren.push(
      new Paragraph({
        spacing: { after: 140 },
        children: [
          new TextRun({
            text: 'This warranty does not cover defects or damage resulting from improper installation, misuse, accidents, unauthorized modification, negligence, incorrect handling, external causes, or normal wear and tear. Proof of purchase and relevant product identification details may be required for any warranty claim.',
            font: 'Times New Roman',
            size: 20,
          }),
        ],
      })
    );

    // Clause 4
    docChildren.push(
      new Paragraph({
        spacing: { after: 140 },
        children: [
          new TextRun({
            text: 'The decision of ',
            font: 'Times New Roman',
            size: 20,
          }),
          new TextRun({
            text: 'Kevilton Electrical Products (Pvt.) Ltd.',
            font: 'Times New Roman',
            size: 20,
            bold: true,
          }),
          new TextRun({
            text: ' shall be final regarding any warranty claim or dispute that may arise. This letter is issued upon request as a warranty reference for the above-mentioned product.',
            font: 'Times New Roman',
            size: 20,
          }),
        ],
      })
    );

    // Clause 5
    docChildren.push(
      new Paragraph({
        spacing: { after: 140 },
        children: [
          new TextRun({
            text: 'Should you require any further information regarding this warranty, please do not hesitate to contact us.',
            font: 'Times New Roman',
            size: 20,
          }),
        ],
      })
    );

    docChildren.push(
      new Paragraph({
        spacing: { after: 120 },
        children: [new TextRun({ text: 'Thank you.', font: 'Times New Roman', size: 21 })],
      })
    );
    docChildren.push(
      new Paragraph({
        spacing: { after: 120 },
        children: [
          new TextRun({
            text: 'Yours Faithfully,',
            font: 'Times New Roman',
            size: 21,
            bold: true,
          }),
        ],
      })
    );
    docChildren.push(
      new Paragraph({
        spacing: { after: 600 },
        children: [
          new TextRun({
            text: 'Kevilton Electrical Products (Pvt.) Ltd.',
            font: 'Times New Roman',
            size: 21,
            bold: true,
          }),
        ],
      })
    );

    // Signature line
    docChildren.push(
      new Paragraph({
        spacing: { after: 80 },
        children: [
          new TextRun({
            text: '.............................................',
            font: 'Times New Roman',
            size: 20,
          }),
        ],
      })
    );
    docChildren.push(
      new Paragraph({
        spacing: { after: 60 },
        children: [
          new TextRun({
            text: 'Manager – Quality Assurance',
            font: 'Times New Roman',
            size: 20,
            bold: true,
          }),
        ],
      })
    );
    docChildren.push(
      new Paragraph({
        spacing: { after: 60 },
        children: [
          new TextRun({
            text: 'Kevilton Electrical Products (Pvt.) Ltd.',
            font: 'Times New Roman',
            size: 20,
            bold: true,
          }),
        ],
      })
    );
  }

  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            size: {
              width: 12240, // 8.5 inches (in DXA: 8.5 * 1440)
              height: 15840, // 11.0 inches (in DXA: 11.0 * 1440)
            },
            margin: {
              top: 1440, // 1 inch (1440 dxa)
              bottom: 1440, // 1 inch
              left: 1440, // 1 inch
              right: 1440, // 1 inch
            },
          },
        },
        children: docChildren,
      },
    ],
  });

  return await Packer.toBlob(doc);
}

function createTableCell(text: string, isHeader: boolean, widthDxa: number): TableCell {
  const borderRule = {
    style: BorderStyle.SINGLE,
    size: 2,
    color: '555555',
  };

  return new TableCell({
    width: { size: widthDxa, type: WidthType.DXA },
    borders: {
      top: borderRule,
      bottom: borderRule,
      left: borderRule,
      right: borderRule,
    },
    children: [
      new Paragraph({
        spacing: { before: 80, after: 80 },
        children: [
          new TextRun({
            text,
            font: 'Times New Roman',
            size: isHeader ? 20 : 20,
            bold: isHeader,
          }),
        ],
      }),
    ],
  });
}
