import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function generatePrefix(name: string): string {
  // Take first 3 letters of words, or just 3 letters of the first word
  const words = name.replace(/[^a-zA-Z0-9\s]/g, "").split(/\s+/).filter(Boolean);
  if (words.length >= 3) {
    return (words[0][0] + words[1][0] + words[2][0]).toUpperCase();
  }
  if (words.length === 2) {
    return (words[0][0] + words[0][1] + words[1][0]).toUpperCase();
  }
  if (words.length === 1 && words[0].length >= 3) {
    return words[0].substring(0, 3).toUpperCase();
  }
  return name.substring(0, 3).toUpperCase().padEnd(3, "X");
}

async function main() {
  const companies = await prisma.company.findMany({
    where: { quotePrefix: null }
  });

  console.log(`Found ${companies.length} companies to backfill.`);

  for (const company of companies) {
    let prefix = generatePrefix(company.name);
    
    // Ensure uniqueness
    let isUnique = false;
    let attempt = 0;
    while (!isUnique) {
      const existing = await prisma.company.findUnique({ where: { quotePrefix: prefix } });
      if (!existing) {
        isUnique = true;
      } else {
        attempt++;
        prefix = generatePrefix(company.name).substring(0, 2) + attempt;
      }
    }

    console.log(`Assigning prefix ${prefix} to company ${company.name}`);
    await prisma.company.update({
      where: { id: company.id },
      data: { quotePrefix: prefix }
    });

    // Backfill all quotes for this company
    const quotes = await prisma.quote.findMany({
      where: { companyId: company.id }
    });

    console.log(`Updating ${quotes.length} quotes for ${company.name}`);
    for (const quote of quotes) {
      const oldNum = quote.quoteNumber;
      if (oldNum.startsWith("AQ-")) {
        const newNum = oldNum.replace("AQ-", `${prefix}-`);
        await prisma.quote.update({
          where: { id: quote.id },
          data: { quoteNumber: newNum }
        });
      }
    }
  }

  console.log("Backfill complete.");
}

main().catch(e => {
  console.error(e);
  process.exit(1);
}).finally(async () => {
  await prisma.$disconnect();
});