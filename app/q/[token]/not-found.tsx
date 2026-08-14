import Link from "next/link";

export default function QuoteNotFound() {
  return <main className="publicQuoteShell"><article className="publicQuoteCard card publicQuoteExpired">
    <p className="eyebrow">Quote unavailable</p>
    <h1 className="publicQuoteTitle">We couldn’t find this quote</h1>
    <p className="publicQuoteBlurb">The link may be incomplete, expired, or replaced. Ask the jeweler who sent it to create a new customer link.</p>
    <Link className="publicQuoteCta" href="/">Visit AI AutoQuote</Link>
  </article></main>;
}
