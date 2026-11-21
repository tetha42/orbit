'use client';

import Link from 'next/link';
import { useI18n } from '@/core/i18n';

export default function NotFound() {
  const { t } = useI18n();
  return (
    <main
      style={{
        minHeight: '100dvh',
        backgroundColor: 'var(--ink-bg)',
        color: 'var(--ink-text)',
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
          maxWidth: '480px',
          backgroundColor: 'var(--ink-elevated)',
          border: '1px solid var(--ink-border)',
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
          <span style={{ color: 'var(--ink-text)' }}>HTTP 404</span>
        </div>

        <div style={{ padding: '28px 24px' }}>
          <div
            style={{
              display: 'inline-block',
              padding: '4px 8px',
              backgroundColor: 'var(--ink-card)',
              border: '1px solid var(--ink-border)',
              borderRadius: '4px',
              fontFamily: 'var(--font-mono)',
              fontSize: '11px',
              color: 'var(--ink-text-muted)',
              marginBottom: '16px',
            }}
          >
            ERR_RESOURCE_NOT_FOUND
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
            {t('notFoundTitle')}
          </h1>

          <p
            style={{
              margin: '0 0 24px 0',
              fontSize: '14px',
              lineHeight: 1.6,
              color: '#a1a1aa',
            }}
          >
            {t('notFoundDesc')}
          </p>

          <div
            style={{
              display: 'flex',
              gap: '10px',
              flexWrap: 'wrap',
            }}
          >
            <Link
              href="/"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '10px 16px',
                backgroundColor: '#fafafa',
                color: '#09090b',
                border: '1px solid #fafafa',
                borderRadius: '6px',
                fontSize: '13px',
                fontWeight: 600,
                textDecoration: 'none',
              }}
            >
              {t('verifyReturnConsole')}
            </Link>
            <Link
              href="/verify"
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
              {t('notFoundVerifyBtn')}
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
