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
import { getWarrantyRows, getProductBrandSubject } from './cleanPdfGenerator';
import {
  KEVILTON_COMPANY_NAME,
  resolveLetterContent,
  splitStyledSpans,
} from './letterContent';

function createRichParagraph(
  text: string,
  boldTerms: string[],
  size: number,
  spacingAfter: number
): Paragraph {
  const spans = splitStyledSpans(text, boldTerms);
  return new Paragraph({
    spacing: { after: spacingAfter },
    children: spans.map(
      (span) =>
        new TextRun({
          text: span.text,
          font: 'Times New Roman',
          size,
          bold: !!span.bold,
        })
    ),
  });
}

/**
 * Generates an editable Microsoft Word (.docx) document strictly without
 * header, logo, watermark, rubber seal, or signature image.
 * Uses exact Times New Roman font, standard 1-inch margins, and cleanly formatted tables (no shading).
 */
export async function generateCleanWarrantyDocx(formData: WarrantyFormData): Promise<Blob> {
  const rows = getWarrantyRows(formData);
  const brandSubject = getProductBrandSubject(rows);
  const content = resolveLetterContent(formData, rows, brandSubject);

  const docChildren: (Paragraph | Table)[] = [];

  // 1. Date (Bold in template)
  docChildren.push(
    new Paragraph({
      spacing: { after: 240 },
      children: [
        new TextRun({
          text: content.dateText || '',
          font: 'Times New Roman',
          size: 22, // 11pt
          bold: true,
        }),
      ],
    })
  );

  // 2. Recipient Address Lines (First line like Mr./Ms. [Customer Name] is bold)
  for (let i = 0; i < content.addressLines.length; i++) {
    docChildren.push(
      new Paragraph({
        spacing: { after: 80 },
        children: [
          new TextRun({
            text: content.addressLines[i],
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

  if (content.isPoCertificate) {
    // TEMPLATE 2: Common Warranty Certificate

    // Subject line (Entire line bold)
    docChildren.push(
      new Paragraph({
        spacing: { after: 220 },
        children: [
          new TextRun({
            text: content.subject,
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
            text: content.salutation,
            font: 'Times New Roman',
            size: 22,
            bold: true,
          }),
        ],
      })
    );

    // Opening Paragraph 1
    if (content.introParagraph1.trim()) {
      docChildren.push(
        createRichParagraph(content.introParagraph1, [KEVILTON_COMPANY_NAME], 21, 160)
      );
    }

    // Opening Paragraph 2
    if (content.introParagraph2.trim()) {
      docChildren.push(
        createRichParagraph(content.introParagraph2, [content.poNumberText], 21, 180)
      );
    }

    // Section header (Bold in template)
    if (content.itemsHeader.trim()) {
      docChildren.push(
        new Paragraph({
          spacing: { after: 140 },
          children: [
            new TextRun({
              text: content.itemsHeader,
              font: 'Times New Roman',
              size: 21,
              bold: true,
            }),
          ],
        })
      );
    }

    // Table: Product Description | Product Brand | Warranty Period (No shading)
    const tableHeader = new TableRow({
      tableHeader: true,
      children: [
        createTableCell('Product Description', true, 4560),
        createTableCell('Product Brand', true, 2400),
        createTableCell('Warranty Period', true, 2400),
      ],
    });

    const tableRows = rows.map(
      (r) =>
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

    // Note & Disclaimers
    content.bodyParagraphs.forEach((paragraph, idx) => {
      if (!paragraph.trim()) return;
      docChildren.push(
        createRichParagraph(paragraph, idx === 0 ? ['Note:'] : [], 20, 140)
      );
    });

    if (content.thankYou.trim()) {
      docChildren.push(
        new Paragraph({
          spacing: { after: 120 },
          children: [new TextRun({ text: content.thankYou, font: 'Times New Roman', size: 21 })],
        })
      );
    }
    if (content.closing.trim()) {
      docChildren.push(
        new Paragraph({
          spacing: { after: 500 },
          children: [new TextRun({ text: content.closing, font: 'Times New Roman', size: 21 })],
        })
      );
    }

    // Signature text line
    docChildren.push(
      new Paragraph({
        spacing: { after: 80 },
        children: [
          new TextRun({
            text: content.signatureLine,
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
            text: content.signatoryTitle,
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
            text: content.signatoryCompany,
            font: 'Times New Roman',
            size: 20,
          }),
        ],
      })
    );
  } else {
    // TEMPLATE 1: Common Draft Warranty Certificate (Declaration)

    // Salutation (Bold in template)
    docChildren.push(
      new Paragraph({
        spacing: { after: 200 },
        children: [
          new TextRun({
            text: content.salutation,
            font: 'Times New Roman',
            size: 22,
            bold: true,
          }),
        ],
      })
    );

    // Title: Warranty Declaration for [Product Brand]
    docChildren.push(
      new Paragraph({
        spacing: { after: 180 },
        children: [
          new TextRun({
            text: content.subject,
            font: 'Times New Roman',
            size: 23,
            bold: true,
          }),
        ],
      })
    );

    // Opening Paragraph
    if (content.introParagraph1.trim()) {
      docChildren.push(
        createRichParagraph(
          content.introParagraph1,
          [content.companyName, KEVILTON_COMPANY_NAME],
          21,
          180
        )
      );
    }

    // Table: Product Description | Product Brand | Warranty Period (No shading)
    const tableHeader = new TableRow({
      tableHeader: true,
      children: [
        createTableCell('Product Description', true, 4560),
        createTableCell('Product Brand', true, 2400),
        createTableCell('Warranty Period', true, 2400),
      ],
    });

    const tableRows = rows.map(
      (r) =>
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

    // Body Paragraphs
    content.bodyParagraphs.forEach((paragraph) => {
      if (!paragraph.trim()) return;
      docChildren.push(
        createRichParagraph(paragraph, [KEVILTON_COMPANY_NAME], 20, 140)
      );
    });

    if (content.thankYou.trim()) {
      docChildren.push(
        new Paragraph({
          spacing: { after: 120 },
          children: [new TextRun({ text: content.thankYou, font: 'Times New Roman', size: 21 })],
        })
      );
    }
    if (content.closing.trim()) {
      docChildren.push(
        new Paragraph({
          spacing: { after: 120 },
          children: [
            new TextRun({
              text: content.closing,
              font: 'Times New Roman',
              size: 21,
              bold: true,
            }),
          ],
        })
      );
    }
    if (content.closingCompany.trim()) {
      docChildren.push(
        new Paragraph({
          spacing: { after: 600 },
          children: [
            new TextRun({
              text: content.closingCompany,
              font: 'Times New Roman',
              size: 21,
              bold: true,
            }),
          ],
        })
      );
    }

    // Signature line
    docChildren.push(
      new Paragraph({
        spacing: { after: 80 },
        children: [
          new TextRun({
            text: content.signatureLine,
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
            text: content.signatoryTitle,
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
            text: content.signatoryCompany,
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
            size: 20,
            bold: isHeader,
          }),
        ],
      }),
    ],
  });
}
