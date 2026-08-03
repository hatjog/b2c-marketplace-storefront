'use client';

import { useState } from 'react';

import LocalizedClientLink from '@/components/molecules/LocalizedLink/LocalizedLink';

interface HelpEntry {
  id: string;
  question: string;
  answer: string;
}

interface HelpTopic {
  id: string;
  title: string;
  description: string;
  entries: HelpEntry[];
}

interface HelpLink {
  id: string;
  label: string;
  href: string;
}

interface HelpCenterProps {
  eyebrow: string;
  title: string;
  description: string;
  searchLabel: string;
  searchPlaceholder: string;
  noResultsLabel: string;
  topicsTitle: string;
  trustCardTitle: string;
  trustCardBody: string;
  trustCardPrimaryLabel: string;
  trustCardPrimaryHref: string;
  trustCardSecondaryLabel: string;
  trustCardSecondaryHref: string;
  relatedLinksTitle: string;
  relatedLinks: HelpLink[];
  topics: HelpTopic[];
  sourceMarker: string;
}

function matchesQuery(query: string, value: string) {
  return value.toLowerCase().includes(query.toLowerCase());
}

export function HelpCenter({
  eyebrow,
  title,
  description,
  searchLabel,
  searchPlaceholder,
  noResultsLabel,
  topicsTitle,
  trustCardTitle,
  trustCardBody,
  trustCardPrimaryLabel,
  trustCardPrimaryHref,
  trustCardSecondaryLabel,
  trustCardSecondaryHref,
  relatedLinksTitle,
  relatedLinks,
  topics,
  sourceMarker,
}: HelpCenterProps) {
  const [query, setQuery] = useState('');
  const [openItems, setOpenItems] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(topics.flatMap((topic, topicIndex) =>
      topic.entries.map((entry, entryIndex) => [`${topic.id}:${entry.id}`, topicIndex === 0 && entryIndex === 0])
    ))
  );

  const normalizedQuery = query.trim().toLowerCase();
  const filteredTopics = topics
    .map((topic) => ({
      ...topic,
      entries: normalizedQuery
        ? topic.entries.filter(
            (entry) =>
              matchesQuery(normalizedQuery, topic.title) ||
              matchesQuery(normalizedQuery, topic.description) ||
              matchesQuery(normalizedQuery, entry.question) ||
              matchesQuery(normalizedQuery, entry.answer)
          )
        : topic.entries,
    }))
    .filter((topic) => topic.entries.length > 0);

  return (
    <main
      data-testid="help-page"
      data-help-source={sourceMarker}
      style={{
        padding: '2rem 1rem 4rem',
        background: 'var(--bb-gradient-seller-veil)',
      }}
    >
      <div style={{ maxWidth: '80rem', margin: '0 auto', display: 'grid', gap: '1.5rem' }}>
        <section
          style={{
            border: '1px solid var(--bb-border-soft, rgba(113,88,40,0.12))',
            borderRadius: '2rem',
            padding: 'clamp(1.5rem, 4vw, 3rem)',
            backgroundColor: 'var(--bb-white-86)',
            boxShadow: 'var(--bb-shadow-seller-soft)',
          }}
        >
          <div style={{ display: 'grid', gap: '1rem' }}>
            <span
              style={{
                display: 'inline-flex',
                width: 'fit-content',
                minHeight: '44px',
                alignItems: 'center',
                padding: '0 1rem',
                borderRadius: '999px',
                backgroundColor: 'var(--bb-tint-gold-12)',
                color: 'var(--text-primary)',
                fontSize: '0.875rem',
                fontWeight: 600,
              }}
            >
              {eyebrow}
            </span>
            <h1
              style={{
                fontFamily: '"Cormorant Garamond", serif',
                fontSize: 'clamp(2.4rem, 6vw, 4.75rem)',
                lineHeight: 1,
                margin: 0,
                color: 'var(--text-primary)',
              }}
            >
              {title}
            </h1>
            <p style={{ margin: 0, maxWidth: '44rem', lineHeight: 1.7, color: 'var(--text-secondary)' }}>
              {description}
            </p>
            <label style={{ display: 'grid', gap: '0.5rem', maxWidth: '32rem' }}>
              <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{searchLabel}</span>
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={searchPlaceholder}
                aria-label={searchLabel}
                style={{
                  minHeight: '52px',
                  borderRadius: '999px',
                  border: '1px solid var(--bb-border-soft, rgba(113,88,40,0.12))',
                  padding: '0 1.25rem',
                  backgroundColor: 'var(--bb-white-90)',
                  color: 'var(--text-primary)',
                }}
              />
            </label>
          </div>
        </section>

        <div
          style={{
            display: 'grid',
            gap: '1.5rem',
            gridTemplateColumns: 'minmax(0, 1.85fr) minmax(18rem, 1fr)',
          }}
        >
          <section
            aria-labelledby="help-topics-title"
            style={{
              border: '1px solid var(--bb-border-soft, rgba(113,88,40,0.12))',
              borderRadius: '2rem',
              padding: 'clamp(1.25rem, 3vw, 2rem)',
              backgroundColor: 'var(--bb-white-86)',
            }}
          >
            <h2
              id="help-topics-title"
              style={{
                fontFamily: '"Cormorant Garamond", serif',
                fontSize: '2rem',
                margin: '0 0 1rem',
                color: 'var(--text-primary)',
              }}
            >
              {topicsTitle}
            </h2>

            {filteredTopics.length === 0 ? (
              <p
                aria-live="polite"
                style={{ margin: 0, color: 'var(--text-secondary)', lineHeight: 1.6 }}
              >
                {noResultsLabel}
              </p>
            ) : (
              <div style={{ display: 'grid', gap: '1rem' }}>
                {filteredTopics.map((topic) => (
                  <section
                    key={topic.id}
                    style={{
                      border: '1px solid var(--bb-border-soft, rgba(113,88,40,0.12))',
                      borderRadius: '1.5rem',
                      padding: '1rem',
                      backgroundColor: 'var(--bb-cream-90)',
                    }}
                  >
                    <div style={{ marginBottom: '0.75rem' }}>
                      <h3 style={{ margin: 0, color: 'var(--text-primary)' }}>{topic.title}</h3>
                      <p style={{ margin: '0.4rem 0 0', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                        {topic.description}
                      </p>
                    </div>

                    <div style={{ display: 'grid', gap: '0.75rem' }}>
                      {topic.entries.map((entry) => {
                        const itemKey = `${topic.id}:${entry.id}`;
                        const isOpen = openItems[itemKey] ?? false;
                        const contentId = `${itemKey}-panel`;

                        return (
                          <article
                            key={entry.id}
                            style={{
                              borderTop: '1px solid var(--bb-border-soft, rgba(113,88,40,0.12))',
                              paddingTop: '0.75rem',
                            }}
                          >
                            <button
                              type="button"
                              onClick={() =>
                                setOpenItems((current) => ({
                                  ...current,
                                  [itemKey]: !current[itemKey],
                                }))
                              }
                              aria-expanded={isOpen}
                              aria-controls={contentId}
                              style={{
                                width: '100%',
                                minHeight: '44px',
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                gap: '1rem',
                                background: 'transparent',
                                border: 'none',
                                padding: 0,
                                textAlign: 'left',
                                color: 'var(--text-primary)',
                                cursor: 'pointer',
                              }}
                            >
                              <span style={{ fontWeight: 600 }}>{entry.question}</span>
                              <span
                                aria-hidden="true"
                                style={{
                                  fontSize: '1.25rem',
                                  transform: isOpen ? 'rotate(45deg)' : 'rotate(0deg)',
                                  transition: 'transform 180ms ease',
                                }}
                              >
                                +
                              </span>
                            </button>
                            <div
                              id={contentId}
                              hidden={!isOpen}
                              style={{ paddingTop: isOpen ? '0.75rem' : 0 }}
                            >
                              <p style={{ margin: 0, lineHeight: 1.7, color: 'var(--text-secondary)' }}>
                                {entry.answer}
                              </p>
                            </div>
                          </article>
                        );
                      })}
                    </div>
                  </section>
                ))}
              </div>
            )}
          </section>

          <aside
            style={{
              display: 'grid',
              gap: '1rem',
              alignContent: 'start',
            }}
          >
            <section
              style={{
                borderRadius: '2rem',
                padding: '1.5rem',
                backgroundColor: 'var(--bg-primary, #907032)',
                color: 'var(--content-primary, #faf8f5)',
              }}
            >
              <h2
                style={{
                  margin: '0 0 0.75rem',
                  fontFamily: '"Cormorant Garamond", serif',
                  fontSize: '2rem',
                }}
              >
                {trustCardTitle}
              </h2>
              <p style={{ margin: 0, lineHeight: 1.7 }}>{trustCardBody}</p>
              <div style={{ display: 'grid', gap: '0.75rem', marginTop: '1.25rem' }}>
                <LocalizedClientLink
                  href={trustCardPrimaryHref}
                  className="inline-flex min-h-[44px] items-center justify-center rounded-sm bg-white px-5 py-3 text-sm font-medium text-primary no-underline"
                  data-testid="help-primary-cta"
                >
                  {trustCardPrimaryLabel}
                </LocalizedClientLink>
                <LocalizedClientLink
                  href={trustCardSecondaryHref}
                  className="inline-flex min-h-[44px] items-center justify-center rounded-sm border border-white/40 px-5 py-3 text-sm font-medium text-white no-underline"
                  data-testid="help-secondary-cta"
                >
                  {trustCardSecondaryLabel}
                </LocalizedClientLink>
              </div>
            </section>

            <section
              style={{
                border: '1px solid var(--bb-border-soft, rgba(113,88,40,0.12))',
                borderRadius: '2rem',
                padding: '1.5rem',
                backgroundColor: 'var(--bb-white-86)',
              }}
            >
              <h2 style={{ margin: '0 0 0.75rem', color: 'var(--text-primary)' }}>{relatedLinksTitle}</h2>
              <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'grid', gap: '0.75rem' }}>
                {relatedLinks.map((link) => (
                  <li key={link.id}>
                    <LocalizedClientLink
                      href={link.href}
                      className="inline-flex min-h-[44px] items-center text-sm font-medium text-primary underline"
                    >
                      {link.label}
                    </LocalizedClientLink>
                  </li>
                ))}
              </ul>
            </section>
          </aside>
        </div>
      </div>
    </main>
  );
}
