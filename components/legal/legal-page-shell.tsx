import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { CalendarDays, ChevronRight, FileText, LifeBuoy, Lock, ReceiptText } from "lucide-react";
import { IntentLink } from "@/components/ui/intent-link";

type LegalHighlight = {
  icon: LucideIcon;
  title: string;
  detail: string;
};

type LegalSection = {
  id: string;
  title: string;
  intro?: string;
  points: readonly string[];
};

type LegalPageShellProps = {
  icon: LucideIcon;
  eyebrow: string;
  title: string;
  summary: string;
  effectiveDate: string;
  highlights: readonly LegalHighlight[];
  sections: readonly LegalSection[];
  outro?: ReactNode;
};

const relatedLinks = [
  {
    href: "/terms",
    label: "Terms",
    description: "Membership rules and boundaries",
    icon: FileText
  },
  {
    href: "/privacy",
    label: "Privacy",
    description: "Data handling and security",
    icon: Lock
  },
  {
    href: "/refund",
    label: "Refund",
    description: "No-refund and dispute policy",
    icon: ReceiptText
  },
  {
    href: "/support",
    label: "Support",
    description: "Help for billing and restore access",
    icon: LifeBuoy
  }
] as const;

export function LegalPageShell({
  icon: Icon,
  eyebrow,
  title,
  summary,
  effectiveDate,
  highlights,
  sections,
  outro
}: LegalPageShellProps) {
  return (
    <div className="mx-auto max-w-6xl space-y-6 md:space-y-8">
      <section className="relative overflow-hidden rounded-3xl border border-border/80 bg-surface/85 p-5 shadow-rose sm:p-7 md:p-8">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_90%_0%,rgba(230,75,140,0.22),transparent_40%)]" />
        <div className="relative flex items-start gap-4 sm:gap-5">
          <div className="rounded-2xl border border-accent/35 bg-accent/10 p-3">
            <Icon className="h-6 w-6 text-accent" />
          </div>
          <div className="min-w-0 space-y-3">
            <p className="text-xs uppercase tracking-[0.2em] text-accent">{eyebrow}</p>
            <h1 className="text-3xl font-semibold tracking-tight text-text sm:text-4xl">{title}</h1>
            <p className="max-w-3xl text-sm leading-relaxed text-muted sm:text-base">{summary}</p>
            <p className="inline-flex items-center gap-2 rounded-full border border-border/80 bg-bg/60 px-3 py-1.5 text-xs text-muted">
              <CalendarDays className="h-3.5 w-3.5 text-success" />
              Effective date: {effectiveDate}
            </p>
          </div>
        </div>

        <div className="relative mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {highlights.map((item) => (
            <div key={item.title} className="rounded-2xl border border-border/80 bg-bg/55 p-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-text">
                <item.icon className="h-4 w-4 text-accent" />
                {item.title}
              </div>
              <p className="mt-1.5 text-xs leading-relaxed text-muted sm:text-sm">{item.detail}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="grid gap-5 lg:grid-cols-[260px_minmax(0,1fr)]">
        <aside className="space-y-4 lg:sticky lg:top-24 lg:h-fit">
          <div className="rounded-2xl border border-border/80 bg-surface/75 p-4">
            <p className="text-xs uppercase tracking-[0.15em] text-accent">On this page</p>
            <nav className="mt-3 space-y-1.5">
              {sections.map((section, index) => (
                <a
                  key={section.id}
                  href={`#${section.id}`}
                  className="group flex items-start gap-2 rounded-lg px-2 py-2 text-sm text-muted transition hover:bg-bg/60 hover:text-text"
                >
                  <span className="mt-0.5 text-xs text-accent/85">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <span className="line-clamp-2">{section.title}</span>
                </a>
              ))}
            </nav>
          </div>

          <div className="rounded-2xl border border-border/80 bg-surface/75 p-4">
            <p className="text-xs uppercase tracking-[0.15em] text-accent">Related</p>
            <div className="mt-3 space-y-1.5">
              {relatedLinks.map((item) => (
                <IntentLink
                  key={item.href}
                  href={item.href}
                  className="group flex items-start gap-2 rounded-lg px-2 py-2 transition hover:bg-bg/60"
                >
                  <item.icon className="mt-0.5 h-4 w-4 text-accent/90" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-text">{item.label}</p>
                    <p className="line-clamp-2 text-xs text-muted">{item.description}</p>
                  </div>
                  <ChevronRight className="ml-auto mt-0.5 h-4 w-4 text-muted transition group-hover:text-text" />
                </IntentLink>
              ))}
            </div>
          </div>
        </aside>

        <div className="space-y-4">
          {sections.map((section, index) => (
            <article
              id={section.id}
              key={section.id}
              className="scroll-mt-28 rounded-3xl border border-border/80 bg-surface/70 p-5 sm:p-6"
            >
              <div className="flex items-center gap-3">
                <span className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-accent/40 bg-accent/10 text-xs font-semibold text-accent">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <h2 className="text-lg font-semibold text-text sm:text-xl">{section.title}</h2>
              </div>
              {section.intro ? (
                <p className="mt-3 text-sm leading-relaxed text-muted">{section.intro}</p>
              ) : null}
              <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-muted">
                {section.points.map((point) => (
                  <li key={point}>{point}</li>
                ))}
              </ul>
            </article>
          ))}

          {outro ? (
            <div className="rounded-3xl border border-accent/25 bg-surface/80 p-5 sm:p-6">{outro}</div>
          ) : null}
        </div>
      </section>
    </div>
  );
}
