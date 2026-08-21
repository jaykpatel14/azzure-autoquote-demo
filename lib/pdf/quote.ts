import PDFDocument from "pdfkit/js/pdfkit.standalone";

export type QuotePdfInput = {
  companyName: string;
  quoteNumber: string;
  createdAt: Date;
  customerName?: string | null;
  customerEmail?: string | null;
  customerPhone?: string | null;
  customerNotes?: string | null;
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
  hasPdfImages?: boolean;
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

function drawMetric(
  doc: PDFKit.PDFDocument,
  label: string,
  value: string,
  x: number,
  y: number,
  width: number,
  height = 44
) {
  doc
    .roundedRect(x, y, width, height, 10)
    .fill("#ffffff");
  doc
    .roundedRect(x, y, width, height, 10)
    .lineWidth(1)
    .stroke("#e2e8f0");
  doc.font("Helvetica-Bold").fontSize(8.5).fillColor("#64748b").text(label.toUpperCase(), x + 12, y + 8, {
    width: width - 24,
    characterSpacing: 1.1
  });
  doc.font("Helvetica").fontSize(11).fillColor("#0f172a").text(value, x + 12, y + 20, {
    width: width - 24
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
  doc.roundedRect(x, y, width, height, 10).lineWidth(1).stroke("#cbd5e1");
  if (dataUrl?.trim()) {
    try {
      doc.image(dataUrl, x + 10, y + 10, {
        fit: [width - 20, height - 42],
        align: "center",
        valign: "center"
      });
    } catch {
      doc.font("Helvetica").fontSize(9).fillColor("#64748b").text("Image unavailable", x + 12, y + height / 2 - 8, {
        width: width - 24,
        align: "center"
      });
    }
  } else {
    doc.font("Helvetica").fontSize(9).fillColor("#64748b").text("Image unavailable", x + 12, y + height / 2 - 8, {
      width: width - 24,
      align: "center"
    });
  }
  doc.font("Helvetica-Bold").fontSize(9).fillColor("#475569").text(label, x + 10, y + height - 23, {
    width: width - 20,
    align: "center"
  });
}

function drawPdfHeader(doc: PDFKit.PDFDocument, input: QuotePdfInput, pageLabel?: string) {
  const isAzzureBranded = input.branding === "azzure_watermark" || input.hasPdfImages === false;
  doc.rect(0, 0, doc.page.width, 96).fill("#0f172a");

  if (isAzzureBranded) {
    doc.font("Helvetica-Bold").fontSize(9.5).fillColor("#d9b85f").text("POWERED BY AZZURE AI QUOTE", 48, 30, { characterSpacing: 1.2 });
    doc.font("Helvetica-Bold").fontSize(22).fillColor("#ffffff").text(input.companyName ? `${input.companyName} Quote` : "Azzure AI Quote Estimate", 48, 48);
    doc.font("Helvetica").fontSize(9).fillColor("#94a3b8").text(`Azzure AI Quote\nQuote #${input.quoteNumber}`, 48, 34, {
      align: "right",
      width: doc.page.width - 96,
      lineGap: 3
    });
  } else {
    doc.font("Helvetica-Bold").fontSize(10).fillColor("#d9b85f").text(input.companyName, 48, 32);
    doc.font("Helvetica-Bold").fontSize(23).fillColor("#ffffff").text(pageLabel || "Customer Quote", 48, 50);
    doc.font("Helvetica").fontSize(9).fillColor("#ffffff").text(`Quote ${input.quoteNumber}`, 48, 38, {
      align: "right",
      width: doc.page.width - 96
    });
  }
}

export async function generateQuotePdfBuffer(input: QuotePdfInput) {
  return await new Promise<Buffer>((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 48, bufferPages: true, compress: false });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const branding = input.branding ?? "azzure_watermark";
    const hasPdfImages = input.hasPdfImages ?? (branding !== "azzure_watermark");
    const sellingPrice = input.estimatedSellingPrice ?? input.estimatedPrice;
    const contentWidth = doc.page.width - 96;

    doc.info.Title = `${input.quoteNumber}${branding === "white_label" ? " - Customer Quote" : " - Azzure AI Quote"}`;
    doc.info.Author = input.companyName;

    // ── PAGE 1 ──
    drawPdfHeader(doc, input);

    doc.font("Helvetica-Bold").fontSize(10).fillColor("#64748b").text("APPROVED ESTIMATE", 48, 120, { characterSpacing: 1.2 });
    doc.font("Helvetica-Bold").fontSize(32).fillColor("#0f172a").text(formatCurrency(sellingPrice), 48, 138);

    const customerDetails = [
      input.customerName?.trim() ? `Customer: ${input.customerName.trim()}` : null,
      input.customerEmail?.trim() ? `Email: ${input.customerEmail.trim()}` : null,
      input.customerPhone?.trim() ? `Phone: ${input.customerPhone.trim()}` : null
    ].filter(Boolean).join("   ·   ");

    doc.font("Helvetica").fontSize(9.5).fillColor("#475569").text(
      customerDetails
        ? `${customerDetails}\nPrepared on ${formatDate(input.createdAt)}`
        : `Prepared for Customer on ${formatDate(input.createdAt)}`,
      48,
      178,
      { lineGap: 3 }
    );

    if (!hasPdfImages) {
      // ── STARTER PLAN LAYOUT: NO IMAGE BOXES, ELEGANT 1-PAGE SPECIFICATIONS & TERMS ──
      const details = [
        ["Customer Name", input.customerName?.trim() || "Not specified"],
        ["Jewelry Type", input.jewelryType || "Ring"],
        ["Precious Metal", input.metalType],
        ["Metal Weight", `${input.metalWeightGrams.toFixed(2)} g`],
        ["Center Diamond", `${input.centerDiamondCarats.toFixed(2)} ct`],
        ["Center Shape", input.centerShape || "Round"],
        ["Color / Clarity", input.centerClarity || "E VS1"],
        ["Side Diamonds", `${input.sideDiamondCarats.toFixed(2)} ct total`],
        ["Side Stone Quantity", String(input.sideDiamondQuantity)],
        ["Setting Style", input.settingType || "Prong"]
      ];

      let detailY = 222;
      for (let index = 0; index < details.length; index += 1) {
        const [label, value] = details[index];
        const column = index % 2;
        const row = Math.floor(index / 2);
        const width = (contentWidth - 12) / 2;
        drawMetric(doc, label, value, 48 + column * (width + 12), detailY + row * 52, width, 44);
      }
      detailY += Math.ceil(details.length / 2) * 52 + 16;

      if (input.customerNotes?.trim()) {
        const notesText = input.customerNotes.trim();
        const notesWidth = contentWidth - 24;
        doc.font("Helvetica").fontSize(9);
        const notesBoxHeight = Math.max(54, doc.heightOfString(notesText, { width: notesWidth, lineGap: 2 }) + 34);
        doc.roundedRect(48, detailY, contentWidth, notesBoxHeight, 8).fill("#f8fafc");
        doc.roundedRect(48, detailY, contentWidth, notesBoxHeight, 8).lineWidth(1).stroke("#cbd5e1");
        doc.font("Helvetica-Bold").fontSize(8.5).fillColor("#475569").text("CUSTOMER DESIGN NOTES", 60, detailY + 10);
        doc.font("Helvetica").fontSize(9).fillColor("#0f172a").text(notesText, 60, detailY + 24, {
          width: notesWidth,
          lineGap: 2
        });
        detailY += notesBoxHeight + 12;
      }

      const starterTermsText =
        "This document is an approved preliminary estimate generated by Azzure AI Quote. Final pricing or specifications may be adjusted during master CAD review, stone verification, finger sizing confirmation, or physical casting assessment.";
      const starterTermsWidth = contentWidth - 32;
      doc.font("Helvetica").fontSize(8.5);
      const starterTermsBoxHeight = Math.max(68, doc.heightOfString(starterTermsText, { width: starterTermsWidth, lineGap: 2 }) + 40);
      doc.roundedRect(48, detailY, contentWidth, starterTermsBoxHeight, 10).fill("#eff6ff");
      doc.roundedRect(48, detailY, contentWidth, starterTermsBoxHeight, 10).lineWidth(1).stroke("#bfdbfe");
      doc.font("Helvetica-Bold").fontSize(10).fillColor("#1e3a8a").text("Estimate terms & conditions", 64, detailY + 12);
      doc.font("Helvetica").fontSize(8.5).fillColor("#334155").text(starterTermsText, 64, detailY + 28, {
        width: starterTermsWidth,
        lineGap: 2
      });
    } else {
      // ── PROFESSIONAL / ENTERPRISE / ULTRA LAYOUT: WITH REFERENCE & 3D RENDERING IMAGES ──
      const references = (input.referenceImageDataUrls?.length
        ? input.referenceImageDataUrls
        : [input.customerImageDataUrl]
      ).filter((value): value is string => Boolean(value?.trim()));

      const metricY = 216;
      const metricGap = 10;
      const metricWidth = (contentWidth - metricGap * 2) / 3;
      drawMetric(doc, "Metal", input.metalType, 48, metricY, metricWidth);
      drawMetric(doc, "Jewelry type", input.jewelryType || "Not specified", 48 + metricWidth + metricGap, metricY, metricWidth);
      drawMetric(doc, "Center stone", `${input.centerDiamondCarats.toFixed(2)} ct ${input.centerShape || ""}`.trim(), 48 + (metricWidth + metricGap) * 2, metricY, metricWidth);

      const imageY = 286;
      const imageGap = 14;
      const imageWidth = (contentWidth - imageGap) / 2;
      drawContainedImage(doc, references[0], "Customer reference", 48, imageY, imageWidth, 300);
      drawContainedImage(doc, input.renderingDataUrl, "AI-rendered design", 48 + imageWidth + imageGap, imageY, imageWidth, 300);

      doc.font("Helvetica").fontSize(8.5).fillColor("#64748b").text(
        "The rendered design is illustrative. Final proportions and finishing are confirmed during CAD and production review.",
        48,
        606,
        { width: contentWidth, align: "center" }
      );

      // Page 2: Confirmed Specifications
      doc.addPage();
      drawPdfHeader(doc, input, "Design Specifications");
      doc.font("Helvetica-Bold").fontSize(16).fillColor("#0f172a").text("Confirmed quote details", 48, 126);
      const details = [
        ["Customer Name", input.customerName?.trim() || "Not specified"],
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
        drawMetric(doc, label, value, 48 + column * (width + 12), detailY + row * 54, width);
      }
      detailY += Math.ceil(details.length / 2) * 54 + 14;

      if (input.customerNotes?.trim()) {
        const notesText = input.customerNotes.trim();
        const notesWidth = contentWidth - 24;
        doc.font("Helvetica").fontSize(9);
        const notesBoxHeight = Math.max(54, doc.heightOfString(notesText, { width: notesWidth, lineGap: 2 }) + 34);

        // Long AI-generated notes can push the rest of this section past the
        // bottom of the page — start a fresh page rather than letting the
        // terms box and final price get squeezed or overlapped.
        if (detailY + notesBoxHeight > doc.page.height - 60) {
          doc.addPage();
          drawPdfHeader(doc, input, "Design Specifications");
          detailY = 126;
        }

        doc.roundedRect(48, detailY, contentWidth, notesBoxHeight, 8).fill("#f8fafc");
        doc.roundedRect(48, detailY, contentWidth, notesBoxHeight, 8).lineWidth(1).stroke("#cbd5e1");
        doc.font("Helvetica-Bold").fontSize(8.5).fillColor("#475569").text("CUSTOMER DESIGN NOTES", 60, detailY + 10);
        doc.font("Helvetica").fontSize(9).fillColor("#0f172a").text(notesText, 60, detailY + 24, {
          width: notesWidth,
          lineGap: 2
        });
        detailY += notesBoxHeight + 12;
      }

      const proTermsText =
        "This document is an approved estimate, not a manufacturing invoice. Pricing or specifications may change after CAD review, stone verification, sizing confirmation, or final metal assessment.";
      const proTermsWidth = contentWidth - 32;
      doc.font("Helvetica").fontSize(9);
      const proTermsBoxHeight = Math.max(68, doc.heightOfString(proTermsText, { width: proTermsWidth, lineGap: 2 }) + 40);

      if (detailY + proTermsBoxHeight + 90 > doc.page.height - 60) {
        doc.addPage();
        drawPdfHeader(doc, input, "Design Specifications");
        detailY = 126;
      }

      doc.roundedRect(48, detailY, contentWidth, proTermsBoxHeight, 10).fill("#eff6ff");
      doc.roundedRect(48, detailY, contentWidth, proTermsBoxHeight, 10).lineWidth(1).stroke("#bfdbfe");
      doc.font("Helvetica-Bold").fontSize(10).fillColor("#1e3a8a").text("Estimate terms", 64, detailY + 12);
      doc.font("Helvetica").fontSize(9).fillColor("#334155").text(proTermsText, 64, detailY + 28, {
        width: proTermsWidth,
        lineGap: 2
      });
      doc.font("Helvetica-Bold").fontSize(14).fillColor("#0f172a").text("Final estimate", 48, detailY + proTermsBoxHeight + 24);
      doc.font("Helvetica-Bold").fontSize(24).fillColor("#0f172a").text(formatCurrency(sellingPrice), 48, detailY + proTermsBoxHeight + 44);

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
    }

    // ── FOOTER WATERMARK ──
    const range = doc.bufferedPageRange();
    for (let pageIndex = range.start; pageIndex < range.start + range.count; pageIndex += 1) {
      doc.switchToPage(pageIndex);
      if (branding === "azzure_watermark" || !hasPdfImages) {
        doc.font("Helvetica-Bold").fontSize(8.5).fillColor("#94a3b8").text(
          "Azzure AI Quote · Built by azzuresolutions.com",
          48,
          doc.page.height - 48,
          { width: contentWidth, align: "center", characterSpacing: 0.5 }
        );
      }
    }

    doc.end();
  });
}
