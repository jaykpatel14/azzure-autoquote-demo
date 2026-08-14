import PDFDocument from "pdfkit/js/pdfkit.standalone";

export type QuotePdfInput = {
  companyName: string;
  quoteNumber: string;
  createdAt: Date;
  customerName?: string | null;
  customerImageDataUrl?: string | null;
  metalType: string;
  metalWeightGrams: number;
  centerDiamondCarats: number;
  sideDiamondCarats: number;
  sideDiamondQuantity: number;
  estimatedPrice: number;
  makingPrice?: number | null;
  pricingTier?: string | null;
  tierDivisor?: number | null;
  estimatedSellingPrice?: number | null;
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

function drawSectionTitle(doc: PDFKit.PDFDocument, title: string, x: number, y: number) {
  doc.font("Helvetica-Bold").fontSize(11).fillColor("#6b7280").text(title.toUpperCase(), x, y, {
    characterSpacing: 1.4
  });
}

function drawMetric(
  doc: PDFKit.PDFDocument,
  label: string,
  value: string,
  x: number,
  y: number,
  width: number
) {
  doc
    .roundedRect(x, y, width, 44, 10)
    .fill("#ffffff");
  doc
    .roundedRect(x, y, width, 44, 10)
    .lineWidth(1)
    .stroke("#e5e7eb");
  doc.font("Helvetica-Bold").fontSize(8.5).fillColor("#6b7280").text(label.toUpperCase(), x + 12, y + 8, {
    width: width - 24,
    characterSpacing: 1.1
  });
  doc.font("Helvetica").fontSize(11).fillColor("#111827").text(value, x + 12, y + 20, {
    width: width - 24
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
    const cardHeight = 190;
    const cardWidth = doc.page.width - 96;
    doc.roundedRect(48, cardTop, cardWidth, cardHeight, 14).fill("#f8fafc");
    doc.roundedRect(48, cardTop, cardWidth, cardHeight, 14).lineWidth(1).stroke("#d1d5db");

    const contentLeft = 64;
    const contentTop = cardTop + 18;
    const imageDataUrl = input.customerImageDataUrl?.trim() || null;
    const customerName = input.customerName?.trim() || input.companyName?.trim() || "Customer";
    const photoWidth = 168;
    const photoHeight = 140;
    const photoX = doc.page.width - 48 - photoWidth;
    const photoY = cardTop + 18;
    const detailsRightEdge = photoX - 18;
    const detailsWidth = detailsRightEdge - contentLeft;

    drawSectionTitle(doc, "Customer", contentLeft, contentTop);
    doc
      .font("Helvetica-Bold")
      .fontSize(19)
      .fillColor("#111827")
      .text(customerName, contentLeft, contentTop + 16, {
        width: detailsWidth,
        lineGap: 2,
        ellipsis: true,
        height: 24
      });
    doc
      .font("Helvetica")
      .fontSize(9.5)
      .fillColor("#6b7280")
      .text(`Quote ${input.quoteNumber}`, contentLeft, contentTop + 40, {
        width: detailsWidth
      });

    const summaryRowTop = contentTop + 68;
    const metricGap = 10;
    const metricWidth = Math.floor((detailsWidth - metricGap) / 2);
    drawMetric(doc, "Metal", input.metalType, contentLeft, summaryRowTop, metricWidth);
    drawMetric(doc, "Prepared on", formatDate(input.createdAt), contentLeft + metricWidth + metricGap, summaryRowTop, metricWidth);
    drawMetric(
      doc,
      "Jewelry type",
      input.jewelryType || "Not specified",
      contentLeft,
      summaryRowTop + 58,
      metricWidth
    );
    drawMetric(
      doc,
      "Review status",
      "Ready for approval",
      contentLeft + metricWidth + metricGap,
      summaryRowTop + 58,
      metricWidth
    );

    doc.roundedRect(photoX, photoY, photoWidth, photoHeight, 12).fill("#ffffff");
    doc.roundedRect(photoX, photoY, photoWidth, photoHeight, 12).lineWidth(1).stroke("#d1d5db");
    if (imageDataUrl) {
      doc.image(imageDataUrl, photoX + 10, photoY + 10, {
        fit: [photoWidth - 20, photoHeight - 32],
        align: "center",
        valign: "center"
      });
    } else {
      doc
        .font("Helvetica")
        .fontSize(9)
        .fillColor("#6b7280")
        .text("Analysis photo unavailable", photoX + 12, photoY + 56, {
          width: photoWidth - 32,
          align: "center"
        });
    }
    doc
      .font("Helvetica-Bold")
      .fontSize(9)
      .fillColor("#6b7280")
      .text("Analysis photo", photoX, photoY + photoHeight + 6, {
        width: photoWidth,
        align: "center"
      });

    const detailsTop = cardTop + cardHeight + 24;
    let y = detailsTop;
    doc.font("Helvetica-Bold").fontSize(16).fillColor("#111827").text("Quote details", 48, y);
    y += 34;

    const details = [
      { label: "Metal weight", value: `${input.metalWeightGrams.toFixed(2)} g` },
      { label: "Center diamond", value: `${input.centerDiamondCarats.toFixed(2)} ct` },
      { label: "Side diamonds", value: `${input.sideDiamondCarats.toFixed(2)} ct total` },
      { label: "Side stone quantity", value: `${input.sideDiamondQuantity}` },
      { label: "Center shape", value: input.centerShape || "Not specified" },
      {
        label: "Final selling price",
        value:
          input.estimatedSellingPrice != null
            ? formatCurrency(input.estimatedSellingPrice)
            : formatCurrency(input.estimatedPrice)
      }
    ];

    for (const detail of details) {
      doc
        .roundedRect(48, y - 4, doc.page.width - 96, 34, 8)
        .fill("#ffffff");
      doc
        .roundedRect(48, y - 4, doc.page.width - 96, 34, 8)
        .lineWidth(1)
        .stroke("#e5e7eb");
      doc.font("Helvetica-Bold").fontSize(9).fillColor("#6b7280").text(detail.label.toUpperCase(), 64, y);
      doc.font("Helvetica").fontSize(12).fillColor("#111827").text(detail.value, 64, y + 12);
      y += 40;
    }

    const noteTop = y + 6;
    doc.roundedRect(48, noteTop, doc.page.width - 96, 74, 12).fill("#eff6ff");
    doc.roundedRect(48, noteTop, doc.page.width - 96, 74, 12).lineWidth(1).stroke("#bfdbfe");
    doc
      .font("Helvetica-Bold")
      .fontSize(11)
      .fillColor("#1f2937")
      .text("Important note", 64, noteTop + 13);
    doc
      .font("Helvetica")
      .fontSize(10)
      .fillColor("#374151")
      .text(
        "Final pricing is an approved estimate, not a manufacturing invoice. Production review may change the quote after CAD, stone verification, or metal confirmation.",
        64,
        noteTop + 29,
        { width: doc.page.width - 128 }
      );

    doc
      .font("Helvetica")
      .fontSize(9)
      .fillColor("#6b7280")
      .text(
        "Prepared by Azzure AutoQuote. This PDF is generated from saved quote data and is customer-safe.",
        48,
        noteTop + 84,
        { align: "center", width: doc.page.width - 96 }
      );

    doc.end();
  });
}
