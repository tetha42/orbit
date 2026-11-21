'use client';

import { useEffect, useState } from 'react';
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

export default function GlobalError({
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
  }, []);

  return (
    <html lang={lang}>
      <body
        style={{
          margin: 0,
          minHeight: '100dvh',
          backgroundColor: '#09090b',
          color: '#fafafa',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px',
          fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
        }}
      >
        <div
          style={{
            width: '100%',
            maxWidth: '480px',
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
              borderBottom: '1px solid #27272a',
              backgroundColor: '#0c0c0e',
              fontFamily: 'monospace',
              fontSize: '11px',
              letterSpacing: '0.08em',
              color: '#a1a1aa',
              textTransform: 'uppercase',
            }}
          >
            <span>ORBIT // TETHA42</span>
            <span style={{ color: '#ef4444' }}>{t('errCriticalTag')}</span>
          </div>

          <div style={{ padding: '28px 24px' }}>
            <h1
              style={{
                margin: '0 0 10px 0',
                fontSize: '20px',
                fontWeight: 600,
                letterSpacing: '-0.02em',
                color: '#fafafa',
              }}
            >
              {t('errGlobalTitle')}
            </h1>

            <p
              style={{
                margin: '0 0 24px 0',
                fontSize: '14px',
                lineHeight: 1.6,
                color: '#a1a1aa',
              }}
            >
              {t('errGlobalDesc')}
              {error.digest ? ` (Digest: ${error.digest})` : ''}
            </p>

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
              {t('errReinitBtn')}
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
