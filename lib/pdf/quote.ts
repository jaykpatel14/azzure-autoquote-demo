import PDFDocument from "pdfkit/js/pdfkit.standalone";

export type QuotePdfInput = {
  companyName: string;
  quoteNumber: string;
  createdAt: Date;
  customerName?: string | null;
  customerImageDataUrl?: string | null;
  referenceImageDataUrls?: string[];
  renderingDataUrl?: string | null;
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
  centerClarity?: string | null;
  settingType?: string | null;
  branding?: "azzure_watermark" | "custom_logo" | "white_label";
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

async function generateLegacyQuotePdfBuffer(input: QuotePdfInput) {
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

    const branding = input.branding ?? "azzure_watermark";
    doc.info.Title = `${input.quoteNumber}${branding === "white_label" ? "" : " - AI AutoQuote"}`;
    doc.info.Author = input.companyName;
    doc.info.Subject = "Customer quote";

    doc.rect(0, 0, doc.page.width, 110).fill("#10172a");
    doc.fillColor("#ffffff").font("Helvetica-Bold").fontSize(10).text(input.companyName, 48, 60);
    doc.fontSize(26).text("Customer Quote", 48, 74);
    if (branding === "azzure_watermark") {
      doc.save().fillColor("#c5a03a").opacity(0.12).font("Helvetica-Bold").fontSize(54)
        .rotate(-32, { origin: [doc.page.width / 2, doc.page.height / 2] })
        .text("AI AUTOQUOTE", 80, doc.page.height / 2, { width: doc.page.width - 160, align: "center" }).restore();
    }
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
      { label: "Center clarity", value: input.centerClarity || "Not specified" },
      { label: "Setting type", value: input.settingType || "Not specified" },
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
        branding === "white_label"
          ? `Prepared by ${input.companyName}.`
          : branding === "custom_logo"
            ? `Prepared for ${input.companyName}. Powered by AI AutoQuote.`
            : "Prepared by AI AutoQuote. This PDF is generated from saved quote data and is customer-safe.",
        48,
        noteTop + 84,
        { align: "center", width: doc.page.width - 96 }
      );

    if (input.renderingDataUrl?.trim()) {
      doc.addPage();
      doc.rect(0, 0, doc.page.width, doc.page.height).fill("#f5f3ef");
      doc.font("Helvetica-Bold").fontSize(20).fillColor("#111827").text("Design visualization", 48, 42);
      doc.font("Helvetica").fontSize(9).fillColor("#6b7280").text(`Quote ${input.quoteNumber}`, 48, 68);
      doc.image(input.renderingDataUrl, 48, 96, {
        fit: [doc.page.width - 96, doc.page.height - 190],
        align: "center",
        valign: "center"
      });
      doc.font("Helvetica").fontSize(8.5).fillColor("#6b7280").text(
        "AI-generated design visualization. Appearance is illustrative and may differ from the finished product.",
        48,
        doc.page.height - 66,
        { width: doc.page.width - 96, align: "center" }
      );
    }

    doc.end();
  });
}

function drawContainedImage(
  doc: PDFKit.PDFDocument,
  dataUrl: string | null | undefined,
  label: string,
  x: number,
  y: number,
  width: number,
  height: number
) {
  doc.roundedRect(x, y, width, height, 10).fill("#f8fafc");
  doc.roundedRect(x, y, width, height, 10).lineWidth(1).stroke("#dbe2ea");
  if (dataUrl?.trim()) {
    try {
      doc.image(dataUrl, x + 10, y + 10, {
        fit: [width - 20, height - 42],
        align: "center",
        valign: "center"
      });
    } catch {
      doc.font("Helvetica").fontSize(9).fillColor("#6b7280").text("Image unavailable", x + 12, y + height / 2 - 8, {
        width: width - 24,
        align: "center"
      });
    }
  } else {
    doc.font("Helvetica").fontSize(9).fillColor("#6b7280").text("Image unavailable", x + 12, y + height / 2 - 8, {
      width: width - 24,
      align: "center"
    });
  }
  doc.font("Helvetica-Bold").fontSize(9).fillColor("#4b5563").text(label, x + 10, y + height - 23, {
    width: width - 20,
    align: "center"
  });
}

function drawPdfHeader(doc: PDFKit.PDFDocument, input: QuotePdfInput, pageLabel?: string) {
  doc.rect(0, 0, doc.page.width, 96).fill("#10172a");
  doc.font("Helvetica-Bold").fontSize(10).fillColor("#d9b85f").text(input.companyName, 48, 32);
  doc.font("Helvetica-Bold").fontSize(23).fillColor("#ffffff").text(pageLabel || "Customer Quote", 48, 50);
  doc.font("Helvetica").fontSize(9).fillColor("#ffffff").text(`Quote ${input.quoteNumber}`, 48, 38, {
    align: "right",
    width: doc.page.width - 96
  });
}

export async function generateQuotePdfBuffer(input: QuotePdfInput) {
  return await new Promise<Buffer>((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 48, bufferPages: true, compress: false });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const branding = input.branding ?? "azzure_watermark";
    const references = (input.referenceImageDataUrls?.length
      ? input.referenceImageDataUrls
      : [input.customerImageDataUrl]
    ).filter((value): value is string => Boolean(value?.trim()));
    const sellingPrice = input.estimatedSellingPrice ?? input.estimatedPrice;
    const contentWidth = doc.page.width - 96;

    doc.info.Title = `${input.quoteNumber}${branding === "white_label" ? " - Customer Quote" : " - AI AutoQuote"}`;
    doc.info.Author = input.companyName;
    drawPdfHeader(doc, input);

    doc.font("Helvetica-Bold").fontSize(11).fillColor("#6b7280").text("APPROVED ESTIMATE", 48, 126, { characterSpacing: 1.2 });
    doc.font("Helvetica-Bold").fontSize(34).fillColor("#111827").text(formatCurrency(sellingPrice), 48, 145);
    doc.font("Helvetica").fontSize(10).fillColor("#6b7280").text(
      `Prepared for ${input.customerName?.trim() || "Customer"} on ${formatDate(input.createdAt)}`,
      48,
      188
    );

    const metricY = 220;
    const metricGap = 10;
    const metricWidth = (contentWidth - metricGap * 2) / 3;
    drawMetric(doc, "Metal", input.metalType, 48, metricY, metricWidth);
    drawMetric(doc, "Jewelry type", input.jewelryType || "Not specified", 48 + metricWidth + metricGap, metricY, metricWidth);
    drawMetric(doc, "Center stone", `${input.centerDiamondCarats.toFixed(2)} ct ${input.centerShape || ""}`.trim(), 48 + (metricWidth + metricGap) * 2, metricY, metricWidth);

    const imageY = 292;
    const imageGap = 14;
    const imageWidth = (contentWidth - imageGap) / 2;
    drawContainedImage(doc, references[0], "Customer reference", 48, imageY, imageWidth, 300);
    drawContainedImage(doc, input.renderingDataUrl, "AI-rendered design", 48 + imageWidth + imageGap, imageY, imageWidth, 300);

    doc.font("Helvetica").fontSize(8.5).fillColor("#6b7280").text(
      "The rendered design is illustrative. Final proportions and finishing are confirmed during CAD and production review.",
      48,
      612,
      { width: contentWidth, align: "center" }
    );

    doc.addPage();
    drawPdfHeader(doc, input, "Design Specifications");
    doc.font("Helvetica-Bold").fontSize(16).fillColor("#111827").text("Confirmed quote details", 48, 126);
    const details = [
      ["Metal", input.metalType],
      ["Metal weight", `${input.metalWeightGrams.toFixed(2)} g`],
      ["Center diamond", `${input.centerDiamondCarats.toFixed(2)} ct`],
      ["Center shape", input.centerShape || "Not specified"],
      ["Color / clarity", input.centerClarity || "E VS1"],
      ["Side diamonds", `${input.sideDiamondCarats.toFixed(2)} ct total`],
      ["Side stone quantity", String(input.sideDiamondQuantity)],
      ["Setting", input.settingType || "Not specified"]
    ];
    let detailY = 164;
    for (let index = 0; index < details.length; index += 1) {
      const [label, value] = details[index];
      const column = index % 2;
      const row = Math.floor(index / 2);
      const width = (contentWidth - 12) / 2;
      drawMetric(doc, label, value, 48 + column * (width + 12), detailY + row * 58, width);
    }
    detailY += 4 * 58 + 28;
    doc.roundedRect(48, detailY, contentWidth, 84, 10).fill("#eff6ff");
    doc.roundedRect(48, detailY, contentWidth, 84, 10).lineWidth(1).stroke("#bfdbfe");
    doc.font("Helvetica-Bold").fontSize(11).fillColor("#1f2937").text("Estimate terms", 64, detailY + 14);
    doc.font("Helvetica").fontSize(10).fillColor("#374151").text(
      "This document is an approved estimate, not a manufacturing invoice. Pricing or specifications may change after CAD review, stone verification, sizing confirmation, or final metal assessment.",
      64,
      detailY + 34,
      { width: contentWidth - 32, lineGap: 3 }
    );
    doc.font("Helvetica-Bold").fontSize(15).fillColor("#111827").text("Final estimate", 48, detailY + 116);
    doc.font("Helvetica-Bold").fontSize(26).fillColor("#111827").text(formatCurrency(sellingPrice), 48, detailY + 138);

    const additionalReferences = references.slice(1);
    for (let pageStart = 0; pageStart < additionalReferences.length; pageStart += 4) {
      doc.addPage();
      drawPdfHeader(doc, input, "Customer References");
      const pageImages = additionalReferences.slice(pageStart, pageStart + 4);
      pageImages.forEach((image, index) => {
        const column = index % 2;
        const row = Math.floor(index / 2);
        drawContainedImage(
          doc,
          image,
          `Customer reference ${pageStart + index + 2}`,
          48 + column * (imageWidth + imageGap),
          126 + row * 310,
          imageWidth,
          286
        );
      });
    }

    if (branding === "azzure_watermark") {
      const range = doc.bufferedPageRange();
      for (let pageIndex = range.start; pageIndex < range.start + range.count; pageIndex += 1) {
        doc.switchToPage(pageIndex);
        doc.font("Helvetica").fontSize(8).fillColor("#9ca3af").text("Generated by Azzure AutoQuote", 48, doc.page.height - 62, {
          width: contentWidth,
          align: "center"
        });
      }
    }

    doc.end();
  });
}
