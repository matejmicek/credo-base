import { useEffect } from 'react';
import { useRouter } from 'next/router';
import Header from "../components/Header";

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    // Auto-redirect to deep research after a brief delay
    const timer = setTimeout(() => {
      router.push('/deep-research');
    }, 2000);

    return () => clearTimeout(timer);
  }, [router]);

  return (
    <div>
      <Header />
      <main style={{
        minHeight: '80vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        <div className="container" style={{ textAlign: 'center' }}>
          <div style={{
            width: '60px',
            height: '60px',
            border: '3px solid var(--border-light)',
            borderTop: '3px solid var(--credo-orange)',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            margin: '0 auto 2rem'
          }}></div>

          <h1 style={{
            fontSize: '2.5rem',
            fontWeight: '600',
            marginBottom: '1rem',
            color: 'var(--text-primary)'
          }}>
            Credo Deep Research
          </h1>

          <p style={{
            fontSize: '1.1rem',
            color: 'var(--text-secondary)',
            marginBottom: '2rem'
          }}>
            Redirecting to Deep Research...
          </p>

          <style jsx>{`
            @keyframes spin {
              0% { transform: rotate(0deg); }
              100% { transform: rotate(360deg); }
            }
          `}</style>
        </div>
      </main>
    </div>
  );
}
