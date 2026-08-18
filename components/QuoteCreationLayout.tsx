import type { ReactNode } from "react";

export function QuoteCreationLayout({ steps, preview }: { steps: ReactNode; preview: ReactNode }) {
  return (
    <div className="quoteBuilderLayout">
      <div className="quoteBuilderSteps">{steps}</div>
      <aside className="quoteBuilderPreview">{preview}</aside>
    </div>
  );
}

export function QuoteStepCard({
  number,
  title,
  description,
  children
}: {
  number: string;
  title: string;
  description?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="card quoteStepCard">
      <div className="quoteStepLabel">
        <span className="quoteStepNumber">{number}</span>
        <div>
          <h2 className="quoteStepTitle">{title}</h2>
          {description ? <p className="muted small">{description}</p> : null}
        </div>
      </div>
      {children}
    </section>
  );
}

export function QuoteBuilderPreview({ children }: { children: ReactNode }) {
  return <div className="quotePreviewSticky">{children}</div>;
}
