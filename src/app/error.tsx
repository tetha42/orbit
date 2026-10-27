'use client';

import { useEffect } from 'react';
import Link from 'next/link';

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
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
        fontFamily: 'var(--font-sans, Inter, system-ui, sans-serif)',
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
            borderBottom: '1px solid #27272a',
            backgroundColor: '#0c0c0e',
            fontFamily: 'var(--font-mono, JetBrains Mono, monospace)',
            fontSize: '11px',
            letterSpacing: '0.08em',
            color: '#a1a1aa',
            textTransform: 'uppercase',
          }}
        >
          <span>ORBIT // TETHA42</span>
          <span style={{ color: '#ef4444' }}>RUNTIME FAULT</span>
        </div>

        <div style={{ padding: '28px 24px' }}>
          <div
            style={{
              display: 'inline-block',
              padding: '4px 8px',
              backgroundColor: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              borderRadius: '4px',
              fontFamily: 'var(--font-mono, JetBrains Mono, monospace)',
              fontSize: '11px',
              color: '#f87171',
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
            Application Runtime Exception
          </h1>

          <p
            style={{
              margin: '0 0 20px 0',
              fontSize: '14px',
              lineHeight: 1.6,
              color: '#a1a1aa',
            }}
          >
            An unexpected error occurred while rendering this view. Your session state remains intact. You can retry the operation or return to the main workspace.
          </p>

          {error.message && (
            <pre
              style={{
                margin: '0 0 24px 0',
                padding: '12px',
                backgroundColor: '#09090b',
                border: '1px solid #27272a',
                borderRadius: '6px',
                fontFamily: 'var(--font-mono, JetBrains Mono, monospace)',
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
              Retry Operation
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
              Return Home
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
