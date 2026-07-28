import PDFDocument from "pdfkit/js/pdfkit.standalone";

export type QuotePdfInput = {
  companyName: string;
  quoteNumber: string;
  createdAt: Date;
  customerName?: string | null;
  metalType: string;
  metalWeightGrams: number;
  centerDiamondCarats: number;
  sideDiamondCarats: number;
  sideDiamondQuantity: number;
  estimatedPrice: number;
  jewelryType?: string | null;
  centerShape?: string | null;
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD"
  }).format(value);
}

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric"
  }).format(value);
}

function drawLabelValue(
  doc: PDFKit.PDFDocument,
  label: string,
  value: string,
  options: { x: number; y: number; width: number }
) {
  doc
    .font("Helvetica-Bold")
    .fontSize(9)
    .fillColor("#6b7280")
    .text(label.toUpperCase(), options.x, options.y, {
      width: options.width,
      characterSpacing: 1.1
    });
  doc
    .font("Helvetica")
    .fontSize(12)
    .fillColor("#111827")
    .text(value, options.x, options.y + 14, {
      width: options.width
    });
}

export async function generateQuotePdfBuffer(input: QuotePdfInput) {
  return await new Promise<Buffer>((resolve, reject) => {
    const doc = new PDFDocument({
      size: "A4",
      margin: 48,
      bufferPages: true,
      compress: false
    });

    const chunks: Buffer[] = [];
    doc.on("data", (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    doc.info.Title = `${input.quoteNumber} - Azzure AutoQuote`;
    doc.info.Author = input.companyName;
    doc.info.Subject = "Customer quote";

    doc.rect(0, 0, doc.page.width, 110).fill("#10172a");
    doc.fillColor("#ffffff").font("Helvetica-Bold").fontSize(10).text(input.companyName, 48, 60);
    doc.fontSize(26).text("Customer Quote", 48, 74);
    doc
      .font("Helvetica")
      .fontSize(10)
      .text(`Quote ${input.quoteNumber}`, 48, 48, { align: "right", width: doc.page.width - 96 });

    doc.fillColor("#111827");
    doc.font("Helvetica-Bold").fontSize(18).text("Approved final price", 48, 140);
    doc
      .font("Helvetica-Bold")
      .fontSize(30)
      .fillColor("#111827")
      .text(formatCurrency(input.estimatedPrice), 48, 166);
    doc
      .font("Helvetica")
      .fontSize(11)
      .fillColor("#6b7280")
      .text("Approved estimate for customer review and approval.", 48, 208);

    const cardTop = 246;
    const cardHeight = 130;
    const cardWidth = doc.page.width - 96;
    doc.roundedRect(48, cardTop, cardWidth, cardHeight, 14).fill("#f8fafc");
    doc.roundedRect(48, cardTop, cardWidth, cardHeight, 14).lineWidth(1).stroke("#d1d5db");

    const columnWidth = (cardWidth - 32) / 2;
    drawLabelValue(doc, "Customer", input.customerName || "Unassigned", {
      x: 64,
      y: cardTop + 18,
      width: columnWidth
    });
    drawLabelValue(doc, "Metal", input.metalType, {
      x: 64 + columnWidth + 16,
      y: cardTop + 18,
      width: columnWidth
    });
    drawLabelValue(doc, "Jewelry type", input.jewelryType || "Not specified", {
      x: 64,
      y: cardTop + 70,
      width: columnWidth
    });
    drawLabelValue(doc, "Prepared on", formatDate(input.createdAt), {
      x: 64 + columnWidth + 16,
      y: cardTop + 70,
      width: columnWidth
    });

    let y = 408;
    doc.font("Helvetica-Bold").fontSize(16).fillColor("#111827").text("Quote details", 48, y);
    y += 28;

    const details = [
      { label: "Metal weight", value: `${input.metalWeightGrams.toFixed(2)} g` },
      { label: "Center diamond", value: `${input.centerDiamondCarats.toFixed(2)} ct` },
      { label: "Side diamonds", value: `${input.sideDiamondCarats.toFixed(2)} ct total` },
      { label: "Side stone quantity", value: `${input.sideDiamondQuantity}` },
      { label: "Center shape", value: input.centerShape || "Not specified" }
    ];

    for (const detail of details) {
      doc.font("Helvetica-Bold").fontSize(10).fillColor("#6b7280").text(detail.label.toUpperCase(), 48, y);
      doc.font("Helvetica").fontSize(12).fillColor("#111827").text(detail.value, 48, y + 14);
      y += 42;
    }

    doc.roundedRect(48, 640, doc.page.width - 96, 88, 12).fill("#eff6ff");
    doc.roundedRect(48, 640, doc.page.width - 96, 88, 12).lineWidth(1).stroke("#bfdbfe");
    doc
      .font("Helvetica-Bold")
      .fontSize(11)
      .fillColor("#1f2937")
      .text("Important note", 64, 656);
    doc
      .font("Helvetica")
      .fontSize(10)
      .fillColor("#374151")
      .text(
        "Final pricing is an approved estimate, not a manufacturing invoice. Production review may change the quote after CAD, stone verification, or metal confirmation.",
        64,
        672,
        { width: doc.page.width - 128 }
      );

    doc
      .font("Helvetica")
      .fontSize(9)
      .fillColor("#6b7280")
      .text(
        "Prepared by Azzure AutoQuote. This PDF is generated from saved quote data and is customer-safe.",
        48,
        748,
        { align: "center", width: doc.page.width - 96 }
      );

    doc.end();
  });
}
