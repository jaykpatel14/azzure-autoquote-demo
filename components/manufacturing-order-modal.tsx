"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type QuoteForOrder = {
  id: string;
  quoteNumber: string;
  customerName: string | null;
  metalType: string;
  metalWeightGrams: number;
  centerDiamondCarats: number;
  sideDiamondCarats: number;
  sideDiamondQuantity: number;
  centerShape?: string | null;
  settingType?: string | null;
  hasWeddingBand?: boolean | null;
  isTwoTone?: boolean | null;
  estimatedSellingPrice?: number | null;
  estimatedPrice?: number | null;
  renderingImageUrl?: string | null;
  notes?: string | null;
};

const PRODUCT_TYPES = ["Ring", "Pendant", "Earrings", "Bracelet", "Necklace"];
const POLISH_LEVELS = [
  { value: "HIGH_POLISH", label: "High Polish (Standard)" },
  { value: "MATTE", label: "Matte Finish" },
  { value: "SATIN", label: "Satin Brush" },
  { value: "SANDBLAST", label: "Sandblast Textured" }
];
const STONE_ORIGINS = [
  { value: "LAB_GROWN", label: "Lab-Grown Diamond" },
  { value: "NATURAL", label: "Natural Earth-Mined Diamond" },
  { value: "GEMSTONE", label: "Precious Gemstone" }
];
const STONE_SHAPES = ["ROUND", "OVAL", "PEAR", "EMERALD", "CUSHION", "RADIANT", "PRINCESS", "MARQUISE", "HEART", "ASSHER"];
const STONE_PROVIDERS = [
  { value: "CK_SUPPLIED", label: "Supplied by CustomKing" },
  { value: "CUSTOMER_SUPPLIED", label: "Customer Supplied (Walk-in)" },
  { value: "STOCK", label: "Store Stock Inventory" }
];
const SETTING_TYPES = ["PRONG", "BEZEL", "PAVE", "CHANNEL", "FLUSH", "TENSION", "BAR"];
const ENGRAVING_FONTS = ["Script", "Block", "Roman", "Italic"];

export default function ManufacturingOrderModal({ quote }: { quote: QuoteForOrder }) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Form State initialized with AI detected values
  const [jobName, setJobName] = useState(quote.customerName ? `${quote.customerName} - ${quote.quoteNumber}` : `${quote.quoteNumber} Manufacturing Order`);
  const [purchaseOrderNo, setPurchaseOrderNo] = useState(`PO-${quote.quoteNumber.replace(/^AQ-/, "")}`);
  const [productType, setProductType] = useState("Ring");
  const [metalType, setMetalType] = useState(
    quote.metalType.includes("Gold") || quote.metalType.includes("Platinum") || quote.metalType.includes("Silver")
      ? quote.metalType
      : `${quote.metalType} Gold`
  );
  const [size, setSize] = useState("6.5");
  const [qty, setQty] = useState(1);
  const [polishLevel, setPolishLevel] = useState("HIGH_POLISH");
  const [matchingBand, setMatchingBand] = useState(Boolean(quote.hasWeddingBand));
  const [deliveryDate, setDeliveryDate] = useState("");
  const [customerEmail, setCustomerEmail] = useState("cknyc-customer@azzuresolutions.com");

  // Center Stone Specs
  const [centerShape, setCenterShape] = useState((quote.centerShape || "OVAL").toUpperCase());
  const [centerCarat, setCenterCarat] = useState(quote.centerDiamondCarats || 1.5);
  const [centerOrigin, setCenterOrigin] = useState("LAB_GROWN");
  const [centerColor, setCenterColor] = useState("F");
  const [centerClarity, setCenterClarity] = useState("VS1");
  const [centerProvider, setCenterProvider] = useState("CK_SUPPLIED");

  // Side Stone Specs
  const [sideCarat, setSideCarat] = useState(quote.sideDiamondCarats || 0);
  const [sideQty, setSideQty] = useState(quote.sideDiamondQuantity || 0);
  const [sideShape, setSideShape] = useState("ROUND");
  const [sidePlacement, setSidePlacement] = useState("SIDE");
  const [sideProvider, setSideProvider] = useState("CK_SUPPLIED");

  // Setting & Personalization
  const [stoneSettingType, setStoneSettingType] = useState((quote.settingType || "PRONG").toUpperCase());
  const [stoneSettingDescription, setStoneSettingDescription] = useState("4-prong delicate claw setting with open gallery");
  const [engraveMessage, setEngraveMessage] = useState("");
  const [fontfamily, setFontfamily] = useState("Script");
  const [notes, setNotes] = useState(quote.notes || "");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          quoteId: quote.id,
          itemName: jobName,
          purchaseOrderNo,
          jobName,
          productType,
          metalType,
          size,
          qty,
          polishLevel,
          matchingBand,
          deliveryDate: deliveryDate ? new Date(deliveryDate).toISOString() : undefined,
          customerEmail,
          engraveMessage: engraveMessage.trim() || undefined,
          fontfamily: engraveMessage.trim() ? fontfamily : undefined,
          notes,
          centerStoneType: "DIAMOND",
          centerStoneOrigin: centerOrigin,
          centerStoneShape: centerShape,
          centerStoneCarat: Number(centerCarat),
          centerStoneColor: centerColor,
          centerStoneClarity: centerClarity,
          centerStoneProvider: centerProvider,
          sideStoneCarat: Number(sideCarat),
          sideStoneQuantity: Number(sideQty),
          sideStoneShape: sideShape,
          sideStonePlacement: sidePlacement,
          sideStoneProvider: sideProvider,
          stoneSettingType,
          stoneSettingDescription
        })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to submit manufacturing order.");
      }

      setIsOpen(false);
      router.push(`/orders/${data.orderId || data.id}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to place order.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button
        className="button primary"
        type="button"
        onClick={() => setIsOpen(true)}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 8,
          background: "linear-gradient(135deg, #0284c7 0%, #0369a1 100%)",
          boxShadow: "0 4px 12px rgba(2, 132, 199, 0.25)"
        }}
      >
        <span className="material-symbols-outlined" style={{ fontSize: 18 }}>precision_manufacturing</span>
        🚀 Place Manufacturing Order
      </button>

      {isOpen ? (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 1000,
            background: "rgba(15, 23, 42, 0.75)",
            backdropFilter: "blur(8px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16
          }}
        >
          <div
            style={{
              background: "#ffffff",
              borderRadius: 20,
              width: "min(960px, 100%)",
              maxHeight: "90vh",
              display: "flex",
              flexDirection: "column",
              boxShadow: "0 25px 60px rgba(0, 0, 0, 0.3)",
              overflow: "hidden",
              border: "1px solid #e2e8f0"
            }}
          >
            {/* Header */}
            <div
              style={{
                padding: "20px 28px",
                borderBottom: "1px solid #e2e8f0",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                background: "#f8fafc"
              }}
            >
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span
                    style={{
                      background: "#0284c7",
                      color: "#fff",
                      fontSize: 11,
                      fontWeight: 700,
                      letterSpacing: "0.08em",
                      textTransform: "uppercase",
                      padding: "3px 10px",
                      borderRadius: 999
                    }}
                  >
                    CustomKing NYC Production
                  </span>
                  <span style={{ fontSize: 13, color: "#64748b", fontWeight: 500 }}>
                    Ref: {quote.quoteNumber}
                  </span>
                </div>
                <h2 style={{ fontSize: 20, fontWeight: 700, margin: "6px 0 0", color: "#0f172a" }}>
                  Manufacturing Order Studio
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                style={{
                  background: "#f1f5f9",
                  border: "none",
                  borderRadius: "50%",
                  width: 36,
                  height: 36,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                  color: "#64748b"
                }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 20 }}>close</span>
              </button>
            </div>

            {/* Scrollable Form Body */}
            <form onSubmit={handleSubmit} style={{ overflowY: "auto", padding: "24px 28px", display: "flex", flexDirection: "column", gap: 24 }}>
              {error ? (
                <div style={{ padding: "12px 16px", borderRadius: 10, background: "#fef2f2", border: "1px solid #fecaca", color: "#b91c1c", fontSize: 14 }}>
                  {error}
                </div>
              ) : null}

              {/* 1. Job Identity & Routing */}
              <div style={{ background: "#f8fafc", padding: 18, borderRadius: 14, border: "1px solid #e2e8f0" }}>
                <h3 style={{ fontSize: 14, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "#0369a1", margin: "0 0 14px", display: "flex", alignItems: "center", gap: 8 }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 18 }}>badge</span>
                  1. Job Reference &amp; Routing
                </h3>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 14 }}>
                  <label className="field">
                    <span>Job / Customer Label *</span>
                    <input value={jobName} onChange={(e) => setJobName(e.target.value)} required />
                  </label>
                  <label className="field">
                    <span>Purchase Order (PO #)</span>
                    <input value={purchaseOrderNo} onChange={(e) => setPurchaseOrderNo(e.target.value)} />
                  </label>
                  <label className="field">
                    <span>Target Delivery Date</span>
                    <input type="date" value={deliveryDate} onChange={(e) => setDeliveryDate(e.target.value)} />
                  </label>
                  <label className="field">
                    <span>CustomKing Account Email</span>
                    <input value={customerEmail} onChange={(e) => setCustomerEmail(e.target.value)} placeholder="cknyc-customer@azzuresolutions.com" />
                  </label>
                </div>
              </div>

              {/* 2. Product, Metal & Sizing */}
              <div style={{ background: "#f8fafc", padding: 18, borderRadius: 14, border: "1px solid #e2e8f0" }}>
                <h3 style={{ fontSize: 14, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "#0369a1", margin: "0 0 14px", display: "flex", alignItems: "center", gap: 8 }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 18 }}>diamond</span>
                  2. Product, Metal &amp; Sizing Specs
                </h3>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 14 }}>
                  <label className="field">
                    <span>Product Type *</span>
                    <select value={productType} onChange={(e) => setProductType(e.target.value)}>
                      {PRODUCT_TYPES.map((pt) => (
                        <option key={pt} value={pt}>{pt}</option>
                      ))}
                    </select>
                  </label>
                  <label className="field">
                    <span>Metal Alloy *</span>
                    <input value={metalType} onChange={(e) => setMetalType(e.target.value)} required />
                  </label>
                  <label className="field">
                    <span>Ring Size / Length *</span>
                    <input value={size} onChange={(e) => setSize(e.target.value)} placeholder="e.g. 6.5" required />
                  </label>
                  <label className="field">
                    <span>Polish / Surface Finish</span>
                    <select value={polishLevel} onChange={(e) => setPolishLevel(e.target.value)}>
                      {POLISH_LEVELS.map((pl) => (
                        <option key={pl.value} value={pl.value}>{pl.label}</option>
                      ))}
                    </select>
                  </label>
                  <label className="field">
                    <span>Quantity</span>
                    <input type="number" min={1} value={qty} onChange={(e) => setQty(Number(e.target.value) || 1)} />
                  </label>
                </div>
                <div style={{ marginTop: 12 }}>
                  <label style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 14, cursor: "pointer", color: "#334155" }}>
                    <input type="checkbox" checked={matchingBand} onChange={(e) => setMatchingBand(e.target.checked)} />
                    <span style={{ fontWeight: 600 }}>Includes Matching Wedding Band (2-Piece Set)</span>
                  </label>
                </div>
              </div>

              {/* 3. Center & Side Diamond Specifications */}
              <div style={{ background: "#f8fafc", padding: 18, borderRadius: 14, border: "1px solid #e2e8f0" }}>
                <h3 style={{ fontSize: 14, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "#0369a1", margin: "0 0 14px", display: "flex", alignItems: "center", gap: 8 }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 18 }}>auto_awesome</span>
                  3. Center &amp; Accent Stone Details
                </h3>
                
                {/* Center Stone */}
                <div style={{ background: "#ffffff", padding: 14, borderRadius: 10, border: "1px solid #cbd5e1", marginBottom: 14 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                    Center Stone (AI Detected: {quote.centerDiamondCarats}ct {quote.centerShape || "Round"})
                  </span>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 10, marginTop: 10 }}>
                    <label className="field">
                      <span>Origin</span>
                      <select value={centerOrigin} onChange={(e) => setCenterOrigin(e.target.value)}>
                        {STONE_ORIGINS.map((so) => (
                          <option key={so.value} value={so.value}>{so.label}</option>
                        ))}
                      </select>
                    </label>
                    <label className="field">
                      <span>Shape</span>
                      <select value={centerShape} onChange={(e) => setCenterShape(e.target.value)}>
                        {STONE_SHAPES.map((sh) => (
                          <option key={sh} value={sh}>{sh}</option>
                        ))}
                      </select>
                    </label>
                    <label className="field">
                      <span>Carat (ct)</span>
                      <input type="number" step={0.01} value={centerCarat} onChange={(e) => setCenterCarat(Number(e.target.value) || 0)} />
                    </label>
                    <label className="field">
                      <span>Color</span>
                      <input value={centerColor} onChange={(e) => setCenterColor(e.target.value)} placeholder="F" />
                    </label>
                    <label className="field">
                      <span>Clarity</span>
                      <input value={centerClarity} onChange={(e) => setCenterClarity(e.target.value)} placeholder="VS1" />
                    </label>
                    <label className="field">
                      <span>Stone Provider</span>
                      <select value={centerProvider} onChange={(e) => setCenterProvider(e.target.value)}>
                        {STONE_PROVIDERS.map((sp) => (
                          <option key={sp.value} value={sp.value}>{sp.label}</option>
                        ))}
                      </select>
                    </label>
                  </div>
                </div>

                {/* Side Stones */}
                <div style={{ background: "#ffffff", padding: 14, borderRadius: 10, border: "1px solid #cbd5e1" }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                    Side &amp; Accent Stones (AI Detected: {quote.sideDiamondCarats}ct · {quote.sideDiamondQuantity} stones)
                  </span>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 10, marginTop: 10 }}>
                    <label className="field">
                      <span>Total Carats (ct)</span>
                      <input type="number" step={0.01} value={sideCarat} onChange={(e) => setSideCarat(Number(e.target.value) || 0)} />
                    </label>
                    <label className="field">
                      <span>Stone Count</span>
                      <input type="number" value={sideQty} onChange={(e) => setSideQty(Number(e.target.value) || 0)} />
                    </label>
                    <label className="field">
                      <span>Shape</span>
                      <select value={sideShape} onChange={(e) => setSideShape(e.target.value)}>
                        {STONE_SHAPES.map((sh) => (
                          <option key={sh} value={sh}>{sh}</option>
                        ))}
                      </select>
                    </label>
                    <label className="field">
                      <span>Placement</span>
                      <select value={sidePlacement} onChange={(e) => setSidePlacement(e.target.value)}>
                        <option value="SIDE">Side Stones</option>
                        <option value="HALO">Halo Setting</option>
                        <option value="MELEE">Pavé / Melee</option>
                        <option value="ACCENT">Hidden Accent</option>
                      </select>
                    </label>
                    <label className="field">
                      <span>Provider</span>
                      <select value={sideProvider} onChange={(e) => setSideProvider(e.target.value)}>
                        {STONE_PROVIDERS.map((sp) => (
                          <option key={sp.value} value={sp.value}>{sp.label}</option>
                        ))}
                      </select>
                    </label>
                  </div>
                </div>

                {/* Setting Style */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12, marginTop: 14 }}>
                  <label className="field">
                    <span>Stone Setting Type</span>
                    <select value={stoneSettingType} onChange={(e) => setStoneSettingType(e.target.value)}>
                      {SETTING_TYPES.map((st) => (
                        <option key={st} value={st}>{st}</option>
                      ))}
                    </select>
                  </label>
                  <label className="field">
                    <span>Setting Description</span>
                    <input value={stoneSettingDescription} onChange={(e) => setStoneSettingDescription(e.target.value)} placeholder="e.g. 4-prong claw with hidden halo" />
                  </label>
                </div>
              </div>

              {/* 4. Engraving & Workshop Instructions */}
              <div style={{ background: "#f8fafc", padding: 18, borderRadius: 14, border: "1px solid #e2e8f0" }}>
                <h3 style={{ fontSize: 14, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "#0369a1", margin: "0 0 14px", display: "flex", alignItems: "center", gap: 8 }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 18 }}>draw</span>
                  4. Engraving &amp; Workshop Instructions
                </h3>
                <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 14, marginBottom: 14 }}>
                  <label className="field">
                    <span>Inside Band Engraving (Optional)</span>
                    <input value={engraveMessage} onChange={(e) => setEngraveMessage(e.target.value)} placeholder="e.g. Forever & Always 09.20.2026" />
                  </label>
                  <label className="field">
                    <span>Engraving Font</span>
                    <select value={fontfamily} onChange={(e) => setFontfamily(e.target.value)}>
                      {ENGRAVING_FONTS.map((f) => (
                        <option key={f} value={f}>{f}</option>
                      ))}
                    </select>
                  </label>
                </div>
                <label className="field">
                  <span>Special Workshop &amp; Bench Notes</span>
                  <textarea
                    rows={3}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Instructions for casting, filing, metal thickness, or special diamond alignment..."
                  />
                </label>
              </div>

              {/* Footer Actions */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 12, paddingTop: 12, borderTop: "1px solid #e2e8f0" }}>
                <button
                  type="button"
                  className="button secondary"
                  onClick={() => setIsOpen(false)}
                  disabled={loading}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="button primary"
                  disabled={loading}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 8,
                    background: "linear-gradient(135deg, #0284c7 0%, #0369a1 100%)",
                    padding: "12px 28px"
                  }}
                >
                  {loading ? (
                    <><span className="material-symbols-outlined ai-pulse" style={{ fontSize: 18 }}>hourglass_top</span> Dispatching to CustomKing…</>
                  ) : (
                    <><span className="material-symbols-outlined" style={{ fontSize: 18 }}>send</span> Confirm &amp; Dispatch to CustomKing</>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}
