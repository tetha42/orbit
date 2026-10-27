import Link from 'next/link';

export default function NotFound() {
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
            fontFamily: 'var(--font-mono, JetBrains Mono, monospace)',
            fontSize: '11px',
            letterSpacing: '0.08em',
            color: '#a1a1aa',
            textTransform: 'uppercase',
          }}
        >
          <span>ORBIT // TETHA42</span>
          <span style={{ color: '#fafafa' }}>HTTP 404</span>
        </div>

        <div style={{ padding: '28px 24px' }}>
          <div
            style={{
              display: 'inline-block',
              padding: '4px 8px',
              backgroundColor: '#18181b',
              border: '1px solid #27272a',
              borderRadius: '4px',
              fontFamily: 'var(--font-mono, JetBrains Mono, monospace)',
              fontSize: '11px',
              color: '#a1a1aa',
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
            404 — Resource Not Found
          </h1>

          <p
            style={{
              margin: '0 0 24px 0',
              fontSize: '14px',
              lineHeight: 1.6,
              color: '#a1a1aa',
            }}
          >
            The requested route, verification ledger, or workspace asset could not be located on this Orbit node. Verify the URL or return to the primary console.
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
              Return to Console
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
              Verify Document
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
