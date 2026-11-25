import type { ReactNode } from 'react';

export const homeHeroTitle = 'text-4xl font-bold leading-tight tracking-tight sm:text-5xl';

export function HomeHero({ titleId, summary, children }: {
  titleId: string;
  summary: ReactNode;
  children: ReactNode;
}) {
  return (
    <section aria-labelledby={titleId} className="identity-inverse bg-ink px-4 py-7 text-paper sm:py-9">
      <div className="mx-auto grid max-w-6xl items-center gap-5 md:min-h-52 md:grid-cols-2 md:gap-10 lg:gap-16">
        <div className="min-w-0">{summary}</div>
        <div className="min-w-0 border-t border-border pt-5 md:border-l md:border-t-0 md:pl-8 md:pt-0">
          {children}
        </div>
      </div>
    </section>
  );
}
