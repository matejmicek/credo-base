import { useSession, signIn, signOut } from 'next-auth/react'
import Link from 'next/link'
import { useState } from 'react'
import { useRouter } from 'next/router'

export default function Header() {
  const { data: session, status } = useSession()
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const router = useRouter()

  if (status === 'loading') return <div>Loading...</div>

  return (
    <header style={{
      padding: '2rem 0',
      borderBottom: '1px solid var(--border-light)'
    }}>
      <div className="container" style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
      }}>
        <div>
          <img 
            src="/credo_logo.png" 
            alt="Credo"
            style={{ height: '40px', width: 'auto' }}
          />
        </div>

        <nav style={{
          display: 'flex',
          gap: '3rem',
          alignItems: 'flex-start'
        }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <Link href="/deep-research" style={{
              color: router.pathname === '/deep-research' ? 'var(--credo-orange)' : 'var(--text-primary)',
              fontWeight: router.pathname === '/deep-research' ? '500' : 'normal',
              fontSize: '0.9rem'
            }}>
              Deep Research
            </Link>
          </div>

          <div style={{ 
            display: 'flex', 
            flexDirection: 'column', 
            alignItems: 'flex-end',
            gap: '1rem',
            position: 'relative'
          }}>
            {session ? (
              <div style={{ position: 'relative' }}>
                <div 
                  onClick={() => setDropdownOpen(!dropdownOpen)}
                  style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '0.75rem',
                    padding: '0.5rem 1rem',
                    background: 'var(--credo-orange-light)',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    userSelect: 'none'
                  }}
                >
                  <img 
                    src={session.user.image} 
                    alt={session.user.name}
                    style={{
                      width: '28px',
                      height: '28px',
                      borderRadius: '50%'
                    }}
                  />
                  <span style={{ fontSize: '0.9rem', fontWeight: '500' }}>
                    {session.user.name}
                  </span>
                  <svg 
                    width="12" 
                    height="8" 
                    viewBox="0 0 12 8" 
                    style={{ 
                      transform: dropdownOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                      transition: 'transform 0.2s ease'
                    }}
                  >
                    <path d="M1 1L6 6L11 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
                  </svg>
                </div>
                
                {dropdownOpen && (
                  <div style={{
                    position: 'absolute',
                    top: '100%',
                    right: '0',
                    marginTop: '0.5rem',
                    background: 'white',
                    border: '1px solid var(--border-light)',
                    borderRadius: '8px',
                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                    minWidth: '140px',
                    zIndex: 10
                  }}>
                    <button 
                      onClick={() => {
                        signOut()
                        setDropdownOpen(false)
                      }}
                      style={{
                        width: '100%',
                        padding: '0.75rem 1rem',
                        border: 'none',
                        background: 'transparent',
                        textAlign: 'left',
                        fontSize: '0.9rem',
                        color: 'var(--text-primary)',
                        cursor: 'pointer',
                        borderRadius: '8px'
                      }}
                      onMouseEnter={(e) => {
                        e.target.style.background = 'var(--credo-orange-light)'
                      }}
                      onMouseLeave={(e) => {
                        e.target.style.background = 'transparent'
                      }}
                    >
                      Sign out
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <button 
                onClick={() => signIn('google')}
                className="btn-primary"
                style={{ fontSize: '0.9rem' }}
              >
                Sign in with Google
              </button>
            )}
          </div>
        </nav>
      </div>
    </header>
  )
}