const fs = require('fs');

function resolveFile(filePath) {
    if (!fs.existsSync(filePath)) return;
    let content = fs.readFileSync(filePath, 'utf-8');
    
    // Check if there are conflict markers
    if (!content.includes('<<<<<<< HEAD')) return;
    
    console.log(`Resolving ${filePath}...`);
    
    const conflictRegex = /<<<<<<< HEAD\n([\s\S]*?)=======\n([\s\S]*?)>>>>>>> [^\n]+\n/g;
    
    content = content.replace(conflictRegex, (match, head, theirs) => {
        // Simple heuristic: keep both, but deduplicate identical lines (ignoring whitespace)
        const headLines = head.split('\n');
        const theirLines = theirs.split('\n');
        
        const uniqueLines = [];
        const seen = new Set();
        
        [...theirLines, ...headLines].forEach(line => {
            if (!line.trim()) return;
            const normalized = line.trim().replace(/\s+/g, ' ');
            if (!seen.has(normalized)) {
                seen.add(normalized);
                uniqueLines.push(line);
            }
        });
        
        return uniqueLines.join('\n') + '\n';
    });
    
    fs.writeFileSync(filePath, content);
}

const files = [
    'app/admin/orders/[orderId]/page.tsx',
    'app/admin/orders/page.tsx',
    'app/admin/page.tsx',
    'app/admin/tenants/[companyId]/page.tsx',
    'app/admin/tenants/subscriptions/page.tsx',
    'app/api/analyze/route.ts',
    'app/api/orders/route.ts',
    'app/api/quotes/route.ts',
    'app/orders/page.tsx',
    'app/quotes/[quoteId]/page.tsx',
    'components/QuoteCalculator.tsx',
    'lib/admin-companies.ts',
    'lib/company.ts',
    'lib/internal-admin-nav.ts',
    'lib/metal-pricing.ts',
    'lib/sanitize.ts',
    'lib/workspace-nav.ts',
    'prisma/schema.prisma',
    'src/services/admin-orders.ts',
    'src/services/orders.ts',
    'src/services/quotes.ts',
    'tsconfig.tsbuildinfo'
];

files.forEach(resolveFile);
console.log('Done.');
