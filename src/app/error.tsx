'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { translate, type Language } from '@/lib/i18n';
import { DEFAULT_LOCALE, isSupportedLocale, normalizeLocale } from '@/locales/registry';

function resolveClientLanguage(): Language {
  try {
    const stored = localStorage.getItem('orbit_locale');
    if (isSupportedLocale(stored)) return stored;
  } catch {
    // Storage blocked: fall back to document or browser language
  }
  if (typeof document !== 'undefined') {
    const attr = document.documentElement.getAttribute('lang');
    if (isSupportedLocale(attr)) return attr;
  }
  if (typeof navigator !== 'undefined') {
    return normalizeLocale(navigator.language, DEFAULT_LOCALE);
  }
  return DEFAULT_LOCALE;
}

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const [lang, setLang] = useState<Language>(DEFAULT_LOCALE);
  const t = (key: string) => translate(lang, key);

  useEffect(() => {
    setLang(resolveClientLanguage());
    console.error('[Orbit Runtime Error]:', error);
  }, [error]);

  return (
    <main
      style={{
        minHeight: '100dvh',
        backgroundColor: '#09090b',
        color: '#fafafa',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
        fontFamily: 'var(--font-sans)',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '500px',
          backgroundColor: '#111113',
          border: '1px solid #27272a',
          borderRadius: '8px',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '12px 16px',
            borderBottom: '1px solid var(--ink-border)',
            backgroundColor: 'var(--ink-surface)',
            fontFamily: 'var(--font-mono)',
            fontSize: '11px',
            letterSpacing: '0.08em',
            color: 'var(--ink-text-muted)',
            textTransform: 'uppercase',
          }}
        >
          <span>ORBIT // TETHA42</span>
          <span style={{ color: 'var(--danger)' }}>{t('errRuntimeTag')}</span>
        </div>

        <div style={{ padding: '28px 24px' }}>
          <div
            style={{
              display: 'inline-block',
              padding: '4px 8px',
              backgroundColor: 'var(--danger-subtle)',
              border: '1px solid var(--danger-border)',
              borderRadius: '4px',
              fontFamily: 'var(--font-mono)',
              fontSize: '11px',
              color: 'var(--danger)',
              marginBottom: '16px',
            }}
          >
            {error.digest ? `DIGEST: ${error.digest}` : 'UNHANDLED_EXCEPTION'}
          </div>

          <h1
            style={{
              margin: '0 0 10px 0',
              fontSize: '20px',
              fontWeight: 600,
              letterSpacing: '-0.02em',
              color: '#fafafa',
            }}
          >
            {t('errRuntimeTitle')}
          </h1>

          <p
            style={{
              margin: '0 0 20px 0',
              fontSize: '14px',
              lineHeight: 1.6,
              color: '#a1a1aa',
            }}
          >
            {t('errRuntimeDesc')}
          </p>

          {error.message && (
            <pre
              style={{
                margin: '0 0 24px 0',
                padding: '12px',
                backgroundColor: '#09090b',
                border: '1px solid #27272a',
                borderRadius: '6px',
                fontFamily: 'var(--font-mono)',
                fontSize: '12px',
                color: '#a1a1aa',
                overflowX: 'auto',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
              }}
            >
              {error.message}
            </pre>
          )}

          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={() => reset()}
              style={{
                padding: '10px 16px',
                backgroundColor: '#fafafa',
                color: '#09090b',
                border: '1px solid #fafafa',
                borderRadius: '6px',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              {t('errRetryBtn')}
            </button>
            <Link
              href="/"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '10px 16px',
                backgroundColor: '#18181b',
                color: '#fafafa',
                border: '1px solid #27272a',
                borderRadius: '6px',
                fontSize: '13px',
                fontWeight: 500,
                textDecoration: 'none',
              }}
            >
              {t('errReturnHome')}
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
