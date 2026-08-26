import OpenAI from "openai";
import { resolveRuntimeSetting } from "@/lib/app-settings";
import { z } from "zod";
import { zodTextFormat } from "openai/helpers/zod";

export type DynamicJewelryFact = {
  category: string;
  icon: string;
  headline: string;
  fact: string;
  sourceOrTrend?: string;
  trivia?: {
    question: string;
    answer: string;
  };
};

export const FALLBACK_JEWELRY_FACTS: DynamicJewelryFact[] = [
  {
    category: "Precious Metals",
    icon: "award_star",
    headline: "Platinum is 30x Rarer Than Gold",
    fact: "If all the platinum ever mined in human history were poured into an Olympic pool, it would barely cover your ankles. Gold would fill more than three entire pools. It is naturally hypoallergenic and develops a velvety patina that lasts generations.",
    sourceOrTrend: "World Platinum Investment Council",
    trivia: {
      question: "Why does platinum feel so heavy in hand?",
      answer: "Platinum is 60% denser than 14K gold, giving it that unmistakable luxury heirloom heft."
    }
  },
  {
    category: "Diamond Cuts",
    icon: "diamond",
    headline: "The Optical Fire of the Oval Cut",
    fact: "Engineered with 57–58 precision facets, the Oval brilliant cut maximizes internal light return while creating an optical illusion that makes fingers appear longer and stones look up to 10% larger than round cuts of identical carat weight.",
    sourceOrTrend: "Gemological Institute of America",
    trivia: {
      question: "Which cut reflects the most total light?",
      answer: "The Round Brilliant cut, mathematically proportioned for 100% total internal reflection."
    }
  },
  {
    category: "Custom Craftsmanship",
    icon: "engineering",
    headline: "The Lost-Wax 3D Casting Secret",
    fact: "Your custom ring is sculpted in high-resolution 3D CAD, printed in castable wax resin, and cast under high vacuum. Master jewelers use 25% excess molten gold reservoir volume to eliminate microscopic porosity.",
    sourceOrTrend: "Master Bench Guild",
    trivia: {
      question: "What is porosity in fine jewelry?",
      answer: "Microscopic air pockets. Vacuum casting ensures dense, glass-smooth metal integrity."
    }
  },
  {
    category: "Gold Metallurgy",
    icon: "savings",
    headline: "Why 14K vs 18K Gold Matters",
    fact: "14K Gold contains 58.5% pure gold alloyed with copper and silver, creating the ultimate durability for daily active wear. 18K contains 75% pure gold for a richer European heirloom luster.",
    sourceOrTrend: "Precious Metal Refining Standards",
    trivia: {
      question: "Why is 24K gold rarely used for rings?",
      answer: "Pure 24K gold is too soft and can bend or lose diamonds with everyday wear."
    }
  },
  {
    category: "Anatomy of a Ring",
    icon: "visibility",
    headline: "The Secret of the Hidden Halo",
    fact: "A hidden halo wraps microscopic pavé diamonds underneath the center stone's gallery prongs, providing 360° side fire and sparkle without changing the classic top silhouette.",
    sourceOrTrend: "Haute Joaillerie Atelier",
    trivia: {
      question: "How small are pavé side diamonds?",
      answer: "Often under 1 millimeter, hand-beaded under high-power 80x gemological microscopes."
    }
  },
  {
    category: "Ancient Earth Lore",
    icon: "auto_awesome",
    headline: "Formed 100 Miles Deep Inside Earth",
    fact: "Natural diamonds formed 1 to 3.5 billion years ago under colossal heat and pressure 100 miles below the earth's crust, carried upward by ancient volcanic magma pipes called kimberlites.",
    sourceOrTrend: "Smithsonian Mineral Sciences",
    trivia: {
      question: "How old is a natural diamond?",
      answer: "Most natural diamonds are older than dinosaurs and nearly a quarter the age of the universe!"
    }
  },
  {
    category: "Ring Anatomy",
    icon: "hardware",
    headline: "Why Hidden Halos Look Bigger",
    fact: "A hidden halo sits under the center stone, so it adds sparkle from the side without changing the face-up shape. That little trick can make a ring feel dramatically larger under showroom lights.",
    sourceOrTrend: "Atelier Craft Notes",
    trivia: {
      question: "What does a hidden halo actually do?",
      answer: "It adds hidden brilliance beneath the center stone for extra sparkle and a larger visual profile."
    }
  },
  {
    category: "Diamond Science",
    icon: "diamond",
    headline: "Why Cut Beats Carat",
    fact: "Two diamonds with the same carat weight can look very different depending on cut quality. A well-cut stone returns more light, so it often looks brighter and sometimes even larger than a heavier but poorly cut diamond.",
    sourceOrTrend: "GIA Cut Grading",
    trivia: {
      question: "Which matters more for sparkle: cut or carat?",
      answer: "Cut is usually the biggest driver of sparkle and visual size."
    }
  },
  {
    category: "Metal Craft",
    icon: "savings",
    headline: "The Secret of Rhodium Finish",
    fact: "White gold is often finished with rhodium plating to create a cooler, brighter surface. Over time, that finish can wear and reveal the warmer gold tone beneath, which is why periodic re-plating is common.",
    sourceOrTrend: "Bench Jeweler Finish Guide",
    trivia: {
      question: "Why is white gold re-plated?",
      answer: "To restore its bright white surface after the rhodium finish wears down."
    }
  },
  {
    category: "Gemology Lore",
    icon: "visibility",
    headline: "Ovals Stretch the Finger",
    fact: "Elongated center stones like oval, pear, and marquise shapes create a longer visual line on the hand. That flattering proportion is one reason they stay popular in custom bridal design.",
    sourceOrTrend: "Shape Proportion Trend",
    trivia: {
      question: "Which shape is famous for making fingers look longer?",
      answer: "Oval, pear, and marquise cuts all create a lengthening effect."
    }
  }
];

const jewelryFactsResponseSchema = z.object({
  facts: z.array(
    z.object({
      category: z.string(),
      icon: z.string(),
      headline: z.string(),
      fact: z.string(),
      sourceOrTrend: z.string().optional(),
      trivia: z
        .object({
          question: z.string(),
          answer: z.string()
        })
        .optional()
    })
  )
});

// In-memory cache with 30-minute expiration
let cachedFacts: DynamicJewelryFact[] | null = null;
let cacheExpiry = 0;

export async function fetchAIWebJewelryFacts(forceFresh = false): Promise<DynamicJewelryFact[]> {
  const now = Date.now();
  if (!forceFresh && cachedFacts && cachedFacts.length > 0 && now < cacheExpiry) {
    return cachedFacts;
  }

  const apiKey =
    (await resolveRuntimeSetting("OPENAI_API_KEY", process.env.OPENAI_API_KEY)) ||
    process.env.OPENAI_API_KEY;

  if (!apiKey) {
    return FALLBACK_JEWELRY_FACTS;
  }

  try {
    const client = new OpenAI({ apiKey, maxRetries: 1 });
    const model =
      (await resolveRuntimeSetting("OPENAI_MODEL", process.env.OPENAI_MODEL)) ||
      "gpt-5-mini";

    const prompt = `Search the web and fine jewelry gemology archives for 10 highly entertaining, viral, and fascinating facts and trivia about custom fine jewelry, diamonds, precious metals, colored gemstones, and engagement ring craftsmanship.
    
Make each fact deeply interesting so customers in a jewelry showroom love reading it while waiting for their AI quote.

Topics to include:
1. Diamond cutting, optical fire, or famous historical diamonds.
2. Precious metals (Platinum, 14K/18K Gold, Rose Gold, Titanium) and metallurgy.
3. Master bench jeweler techniques (micro-pavé, lost-wax casting, CAD design).
4. Gemology trivia & geological diamond formations.
5. Unique ring designs (hidden halos, bezel settings, cathedral shanks).

For each fact provide:
- category: Short category tag (e.g. "Diamond Secrets", "Metal Metallurgy", "Atelier Craft", "Gemology Lore")
- icon: Material Symbols icon name (e.g. "diamond", "award_star", "hardware", "visibility", "savings", "auto_awesome")
- headline: Catchy 3-7 word title
- fact: 2-3 engaging, easily readable sentences
- sourceOrTrend: Reference or organization (e.g. "GIA Gemology", "World Gold Council", "Bench Master Guide")
- trivia: An interactive question and its short answer for customer quizzes.`;

    const response = await client.responses.parse({
      model,
      store: false,
      tools: [{ type: "web_search_preview", search_context_size: "medium" }],
      input: [
        {
          role: "developer",
          content: "You are a world-class master gemologist and fine jewelry historian. Search the web and return fresh, verified, fascinating fine jewelry facts formatted strictly according to the schema."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      text: {
        format: zodTextFormat(jewelryFactsResponseSchema, "jewelry_facts")
      }
    });

    const parsed = response.output_parsed as { facts: DynamicJewelryFact[] } | undefined;
    if (parsed && Array.isArray(parsed.facts) && parsed.facts.length >= 8) {
      cachedFacts = parsed.facts;
      cacheExpiry = now + 30 * 60 * 1000; // 30 minutes cache
      return parsed.facts;
    }
  } catch (err) {
    console.warn("AI web search facts failed, using fallback curated facts:", err);
  }

  return FALLBACK_JEWELRY_FACTS;
}
