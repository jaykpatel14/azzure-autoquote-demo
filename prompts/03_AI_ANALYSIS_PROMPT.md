# Phase 3 — AI Jewelry Analysis Prompt

Complete the AI analysis subsystem.

Requirements:
1. Use the OpenAI Responses API server-side.
2. Set `store: false` unless product policy explicitly changes.
3. Accept JPG, PNG, and WEBP only, maximum 8 MB.
4. Run image moderation before analysis.
5. Make three independent review calls.
6. Require structured output matching a Zod schema:
   - jewelry type;
   - selected metal;
   - metal weight grams;
   - center diamond weight;
   - side diamond total weight;
   - side diamond quantity;
   - optional center shape;
   - confidence;
   - assumptions.
7. Aggregate numeric values by median.
8. Record each attempt separately with model, latency, token usage when available, output, and errors.
9. Add retry logic only for transient errors and never charge an extra customer unit for automatic retries.
10. Add a provider adapter so another AI model can be added later.
11. Store prompt versions and model versions.
12. Add evaluation fixtures using representative jewelry images supplied by the product owner.
13. Never present the estimate as exact.

Add tests using mocked OpenAI responses; CI must not call the real API.
