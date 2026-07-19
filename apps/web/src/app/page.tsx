export default function HomePage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Operations console</h1>
        <p className="mt-1 text-slate-600">
          Custom Home Health Operating System scaffold. Use synthetic demo accounts only.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card
          title="Intake worklist"
          body="Referral → checklist → consent → SOC readiness."
          href="/intake"
        />
        <Card
          title="Clinical tasks"
          body="Large-wound HITL queue for clinical leads."
          href="/tasks"
        />
        <Card
          title="API health"
          body="NestJS API with OpenAPI at /docs on port 3001."
          href="http://localhost:3001/docs"
        />
        <Card
          title="Compliance"
          body="See docs/compliance — BAA required before production PHI."
          href="/intake"
        />
      </div>

      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
        <strong>Compliance:</strong> No real ePHI in this environment. Consent template text is
        placeholder (NOT LEGAL FINAL). AWS BAA required before production.
      </div>
    </div>
  );
}

function Card({
  title,
  body,
  href,
}: {
  title: string;
  body: string;
  href: string;
}) {
  return (
    <a
      href={href}
      className="block rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-brand-600"
    >
      <h2 className="font-medium text-slate-900">{title}</h2>
      <p className="mt-2 text-sm text-slate-600">{body}</p>
    </a>
  );
}
