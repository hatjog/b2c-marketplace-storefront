import type { ReactNode } from 'react';

type SellersIndexLayoutProps = {
  surface: 'W4-01';
  breadcrumbs: ReactNode;
  title: string;
  intro: string;
  controls: ReactNode;
  content: ReactNode;
};

type SellerDetailLayoutProps = {
  surface: 'W4-02';
  breadcrumbs: ReactNode;
  hero: ReactNode;
  trustStrip: ReactNode;
  tabs: ReactNode;
  legal: ReactNode;
  ctaBar: ReactNode;
};

type SellerReviewsLayoutProps = {
  surface: 'W4-03';
  breadcrumbs: ReactNode;
  hero: ReactNode;
  summary: ReactNode;
  content: ReactNode;
  ctaBar: ReactNode;
};

export type SellersDetailLayoutProps =
  | SellersIndexLayoutProps
  | SellerDetailLayoutProps
  | SellerReviewsLayoutProps;

export function SellersDetailLayout(props: SellersDetailLayoutProps) {
  if (props.surface === 'W4-01') {
    return (
      <main
        id="main-content"
        className="bb-page-shell pb-10"
      >
        <div className="container py-4">{props.breadcrumbs}</div>
        <section className="bb-section-shell bb-section-shell-strong border-y border-[var(--bb-border-soft)]">
          <div className="container space-y-4 py-8 md:py-10">
            <div className="max-w-3xl space-y-3">
              <h1 className="heading-lg text-primary">{props.title}</h1>
              <p className="label-md text-secondary">{props.intro}</p>
            </div>
            {props.controls}
          </div>
        </section>
        <div className="container py-6 md:py-8">{props.content}</div>
      </main>
    );
  }

  if (props.surface === 'W4-03') {
    return (
      <main
        id="main-content"
        className="bb-page-shell pb-28"
      >
        <div className="container py-4">{props.breadcrumbs}</div>
        <div className="container space-y-6 pb-8">
          {props.hero}
          <div className="grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)] xl:grid-cols-[340px_minmax(0,1fr)]">
            <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">{props.summary}</aside>
            <div className="min-w-0">{props.content}</div>
          </div>
        </div>
        {props.ctaBar}
      </main>
    );
  }

  return (
    <main
      id="main-content"
      className="bb-page-shell pb-28"
    >
      <div className="container py-4">{props.breadcrumbs}</div>
      <div className="container space-y-6 pb-8">
        {props.hero}
        {props.trustStrip}
        {props.tabs}
        {props.legal}
      </div>
      {props.ctaBar}
    </main>
  );
}
