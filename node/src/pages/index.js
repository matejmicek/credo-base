import Link from "next/link";
import Header from "../components/Header";

export default function Home() {
  return (
    <div>
      <Header />
      <main style={{ minHeight: '80vh', position: 'relative' }}>
        <div className="container" style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '4rem',
          alignItems: 'center',
          minHeight: '70vh'
        }}>
          <div style={{ paddingRight: '2rem' }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '1rem',
              marginBottom: '2rem'
            }}>
              <div style={{
                width: '20px',
                height: '1px',
                background: 'var(--text-primary)'
              }}></div>
              <span style={{
                fontSize: '0.9rem',
                color: 'var(--text-secondary)',
                letterSpacing: '0.05em'
              }}>
                Learn More
              </span>
            </div>
          </div>

          <div>
            <h1 style={{
              fontSize: '3.5rem',
              fontWeight: '600',
              lineHeight: '1.1',
              marginBottom: '2rem',
              color: 'var(--text-primary)'
            }}>
              Internal Tool Portal for Credo Ventures
            </h1>
            <p style={{
              fontSize: '1.2rem',
              color: 'var(--text-secondary)',
              lineHeight: '1.6'
            }}>
              Access portfolio management, deal pipeline, CRM, and fund administration tools in one centralized location.
            </p>
          </div>
        </div>

        <div style={{
          position: 'absolute',
          bottom: '0',
          left: '0',
          right: '0',
          height: '4px',
          background: 'var(--credo-orange)'
        }}></div>

        <div style={{
          position: 'absolute',
          bottom: '8px',
          left: '2rem',
          fontSize: '0.8rem',
          color: 'var(--text-light)'
        }}>
          https://www.credoventures.com
        </div>
      </main>
    </div>
  );
}
