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
import { formatDateForCertificate, parseCustomerAddress } from './templateParser';
import { getWarrantyRows } from './cleanPdfGenerator';

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

  // 1. Date
  docChildren.push(
    new Paragraph({
      spacing: { after: 240 },
      children: [
        new TextRun({
          text: `Date: ${formattedDate || ''}`,
          font: 'Times New Roman',
          size: 22, // 11pt
        }),
      ],
    })
  );

  // 2. Recipient Address Lines
  for (const line of parsedAddr.formattedLines) {
    docChildren.push(
      new Paragraph({
        spacing: { after: 80 },
        children: [
          new TextRun({
            text: line,
            font: 'Times New Roman',
            size: 22,
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

    // Subject line
    docChildren.push(
      new Paragraph({
        spacing: { after: 220 },
        children: [
          new TextRun({
            text: 'Subject: Warranty Certificate for Kevilton Products Supplied',
            font: 'Times New Roman',
            size: 23, // 11.5pt
            bold: true,
          }),
        ],
      })
    );

    // Salutation
    docChildren.push(
      new Paragraph({
        spacing: { after: 180 },
        children: [
          new TextRun({
            text: 'Dear Sir/Madam,',
            font: 'Times New Roman',
            size: 22,
          }),
        ],
      })
    );

    // Paragraph 1
    docChildren.push(
      new Paragraph({
        spacing: { after: 160 },
        children: [
          new TextRun({
            text: 'We, Kevilton Electrical Products (Pvt.) Ltd., sincerely appreciate the trust you have placed in our products. We are committed to providing high-quality products that comply with national and international standards.',
            font: 'Times New Roman',
            size: 21, // 10.5pt
          }),
        ],
      })
    );

    // Paragraph 2
    docChildren.push(
      new Paragraph({
        spacing: { after: 180 },
        children: [
          new TextRun({
            text: 'We hereby confirm that the following products supplied are covered under the Kevilton warranty program.',
            font: 'Times New Roman',
            size: 21,
          }),
        ],
      })
    );

    // Section header
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

    // Table: Product type | Product Brand | Warranty Period (No shading)
    const tableHeader = new TableRow({
      tableHeader: true,
      children: [
        createTableCell('Product type', true, 4200),
        createTableCell('Product Brand', true, 2600),
        createTableCell('Warranty Period', true, 2400),
      ],
    });

    const tableRows = rows.map((r) =>
      new TableRow({
        children: [
          createTableCell(r.productType || r.description, false, 4200),
          createTableCell(r.productBrand || 'Kevilton', false, 2600),
          createTableCell(r.warrantyPeriod, false, 2400),
        ],
      })
    );

    docChildren.push(
      new Table({
        width: { size: 9200, type: WidthType.DXA },
        rows: [tableHeader, ...tableRows],
      })
    );

    docChildren.push(new Paragraph({ spacing: { after: 200 } }));

    // Note & Disclaimers
    const notes = [
      'Note: The above warranty covers manufacturing defects under normal installation and operating conditions from the date of purchase.',
      'This warranty does not cover defects or damage resulting from improper installation, misuse, accidents, unauthorized modifications, negligence, or external causes. Proof of purchase and relevant product identification details are required for any warranty claim.',
      'Should you require any further information regarding this warranty, please do not hesitate to contact us.',
    ];

    for (const note of notes) {
      docChildren.push(
        new Paragraph({
          spacing: { after: 140 },
          children: [
            new TextRun({
              text: note,
              font: 'Times New Roman',
              size: 20, // 10pt
            }),
          ],
        })
      );
    }

    docChildren.push(
      new Paragraph({
        spacing: { after: 120 },
        children: [new TextRun({ text: 'Thank you.', font: 'Times New Roman', size: 21 })],
      })
    );
    docChildren.push(
      new Paragraph({
        spacing: { after: 120 },
        children: [new TextRun({ text: 'Yours faithfully,', font: 'Times New Roman', size: 21 })],
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

    // Signature text line
    docChildren.push(
      new Paragraph({
        spacing: { after: 80 },
        children: [
          new TextRun({
            text: '...........................................................................',
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
    docChildren.push(
      new Paragraph({
        spacing: { after: 200 },
        children: [
          new TextRun({
            text: 'Dear Sir/Madam,',
            font: 'Times New Roman',
            size: 22,
          }),
        ],
      })
    );

    // Title: Warranty Declaration for [Product Description]
    const primaryProdDesc = rows[0]?.description || rows[0]?.productType || '[Product Description]';
    docChildren.push(
      new Paragraph({
        spacing: { after: 180 },
        children: [
          new TextRun({
            text: `Warranty Declaration for ${primaryProdDesc}`,
            font: 'Times New Roman',
            size: 23,
            bold: true,
          }),
        ],
      })
    );

    // Opening Paragraph
    const company = parsedAddr.companyName || '[Company Name]';
    docChildren.push(
      new Paragraph({
        spacing: { after: 180 },
        children: [
          new TextRun({
            text: `With reference to the product supplied to ${company}, we hereby confirm that Kevilton Electrical Products (Pvt.) Ltd. provides the following warranty for the product detailed below:`,
            font: 'Times New Roman',
            size: 21,
          }),
        ],
      })
    );

    // Table: Item Code | Description | Warranty Period (No shading)
    const tableHeader = new TableRow({
      tableHeader: true,
      children: [
        createTableCell('Item Code', true, 2600),
        createTableCell('Description', true, 4200),
        createTableCell('Warranty Period', true, 2400),
      ],
    });

    const tableRows = rows.map((r) =>
      new TableRow({
        children: [
          createTableCell(r.itemCode, false, 2600),
          createTableCell(r.description, false, 4200),
          createTableCell(r.warrantyPeriod, false, 2400),
        ],
      })
    );

    docChildren.push(
      new Table({
        width: { size: 9200, type: WidthType.DXA },
        rows: [tableHeader, ...tableRows],
      })
    );

    docChildren.push(new Paragraph({ spacing: { after: 200 } }));

    // Body Paragraphs
    const bodyParagraphs = [
      'The above warranty covers manufacturing defects arising under normal installation and operating conditions from the date of delivery.',
      'During the warranty period, Kevilton Electrical Products (Pvt.) Ltd. will, at its discretion, repair or replace any product found to be defective due to manufacturing faults.',
      'This warranty does not cover defects or damage resulting from improper installation, misuse, accidents, unauthorized modification, negligence, incorrect handling, external causes, or normal wear and tear. Proof of purchase and relevant product identification details may be required for any warranty claim.',
      'The decision of Kevilton Electrical Products (Pvt.) Ltd. shall be final regarding any warranty claim or dispute that may arise. This letter is issued upon request as a warranty reference for the above-mentioned product.',
      'Should you require any further information regarding this warranty, please do not hesitate to contact us.',
    ];

    for (const paragraph of bodyParagraphs) {
      docChildren.push(
        new Paragraph({
          spacing: { after: 140 },
          children: [
            new TextRun({
              text: paragraph,
              font: 'Times New Roman',
              size: 20,
            }),
          ],
        })
      );
    }

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
            text: '...........................................................................',
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
