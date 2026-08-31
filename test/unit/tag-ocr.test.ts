import { describe, it, expect, vi } from "vitest";
import { extractJewelryTagData } from "@/lib/ai/tag-ocr";
import type OpenAI from "openai";

describe("extractJewelryTagData", () => {
  it("returns null if imageDataUrl is empty", async () => {
    const mockOpenai = {} as OpenAI;
    const result = await extractJewelryTagData(mockOpenai, "");
    expect(result).toBeNull();
  });

  it("extracts jewelry tag data from mock OpenAI OCR response", async () => {
    const mockOpenai = {
      chat: {
        completions: {
          create: vi.fn().mockResolvedValue({
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    hasTag: true,
                    centerCarats: 3.02,
                    sideCarats: 0.32,
                    sideCount: 2,
                    metalPurity: "14K",
                    metalColor: "yellow",
                    centerShape: "Pear",
                    diamondClarity: "VS1",
                    diamondColor: "E",
                    rawText: "14KT Y/G PEAR DIA 3.020 CT / ACCENT DIA 0.320 CT VS1",
                    confidence: "high"
                  })
                }
              }
            ]
          })
        }
      }
    } as unknown as OpenAI;

    const result = await extractJewelryTagData(mockOpenai, "data:image/jpeg;base64,mock");
    expect(result).not.toBeNull();
    expect(result?.hasTag).toBe(true);
    expect(result?.centerCarats).toBe(3.02);
    expect(result?.sideCarats).toBe(0.32);
    expect(result?.metalPurity).toBe("14K");
    expect(result?.diamondClarity).toBe("VS1");
    expect(result?.centerShape).toBe("Pear");
  });

  it("handles images without a tag gracefully", async () => {
    const mockOpenai = {
      chat: {
        completions: {
          create: vi.fn().mockResolvedValue({
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    hasTag: false
                  })
                }
              }
            ]
          })
        }
      }
    } as unknown as OpenAI;

    const result = await extractJewelryTagData(mockOpenai, "data:image/jpeg;base64,mock");
    expect(result).toBeNull();
  });
});
