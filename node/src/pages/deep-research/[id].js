import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/router'
import Header from "../../components/Header"
import { useRealtimeRunsWithTag } from '@trigger.dev/react-hooks'

export default function DealDetail() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const { id } = router.query
  const [deal, setDeal] = useState(null)
  const [loading, setLoading] = useState(true)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [publicToken, setPublicToken] = useState(null)

  useEffect(() => {
    const fetchDeal = async () => {
      try {
        const response = await fetch(`/api/deals/${id}`)
        if (response.ok) {
          const dealData = await response.json()
          setDeal(dealData)
        } else {
          router.push('/deep-research')
        }
      } catch (error) {
        console.error('Error fetching deal:', error)
        router.push('/deep-research')
      } finally {
        setLoading(false)
      }
    }

    if (id && session) {
      fetchDeal()
      fetch(`/api/trigger/public-token?dealId=${id}`)
        .then(res => res.ok ? res.json() : Promise.reject())
        .then(data => setPublicToken(data.token))
        .catch(err => console.error('Failed to fetch public token', err))
    }
  }, [id, session, router])

  // Subscribe to runs for this deal tag
  const { runs: competitorRuns } = useRealtimeRunsWithTag(`deal:${id}`, {
    accessToken: publicToken || undefined,
    enabled: Boolean(publicToken && id),
  })

  const latestRun = competitorRuns && competitorRuns.length > 0 ? competitorRuns[0] : null
  const competitorStatus = latestRun?.metadata?.status || null

  // When a run completes, refetch the deal to load saved competitors
  useEffect(() => {
    if (latestRun?.status === 'COMPLETED' && id && session) {
      fetch(`/api/deals/${id}`)
        .then(res => res.ok ? res.json() : Promise.reject())
        .then(data => setDeal(data))
        .catch(() => {})
    }
  }, [latestRun?.status, id, session])

  // Handle redirection as a side-effect
  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/')
    }
  }, [status, router])

  // Show loading spinner while session is loading or for unauthenticated users before redirect
  if (status !== 'authenticated') {
    return (
      <div style={{ minHeight: '80vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{
          width: '40px',
          height: '40px',
          border: '3px solid var(--border-light)',
          borderTop: '3px solid var(--credo-orange)',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite'
        }}></div>
      </div>
    )
  }

  const handleDelete = async () => {
    try {
      const response = await fetch(`/api/deals?id=${id}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        router.push('/deep-research')
      } else {
        console.error('Failed to delete deal')
      }
    } catch (error) {
      console.error('Error deleting deal:', error)
    }
  }

  const formatAmount = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount)
  }

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  }

  if (loading) {
    return (
      <div>
        <Header />
        <main style={{ minHeight: '80vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{
            width: '60px',
            height: '60px',
            border: '3px solid var(--border-light)',
            borderTop: '3px solid var(--credo-orange)',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite'
          }}></div>
        </main>
        <style jsx>{`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    )
  }

  if (!deal) {
    return (
      <div>
        <Header />
        <main style={{ minHeight: '80vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ textAlign: 'center' }}>
            <h1>Deal not found</h1>
            <button
              onClick={() => router.push('/deep-research')}
              className="btn-primary"
              style={{ marginTop: '1rem' }}
            >
              Back to Deals
            </button>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div>
      <Header />
      <main style={{ padding: '2rem 0', minHeight: '80vh' }}>
        <div className="container">
          {/* Header with back button */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '2rem'
          }}>
            <button
              onClick={() => router.push('/deep-research')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                background: 'none',
                border: 'none',
                color: 'var(--text-primary)',
                cursor: 'pointer',
                fontSize: '1rem'
              }}
            >
              ← Back to Deals
            </button>

            <button
              onClick={() => setShowDeleteConfirm(true)}
              style={{
                background: '#EF4444',
                color: 'white',
                border: 'none',
                padding: '0.5rem 1rem',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '0.9rem'
              }}
            >
              Delete Deal
            </button>
          </div>

          {/* Deal Header */}
          <div style={{
            background: 'white',
            border: '1px solid var(--border-light)',
            borderRadius: '12px',
            padding: '2rem',
            marginBottom: '2rem'
          }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              marginBottom: '1rem'
            }}>
              <div>
                <h1 style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>
                  {deal.companyName}
                </h1>
                <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}></div>
              </div>

              
            </div>

            <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
              Created {formatDate(deal.createdAt)}
            </div>
          </div>

          {/* Deal Content */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: '2rem' }}>
            {/* Main Content */}
            <div>
              {/* Competitors */}
              <div style={{
                background: 'white',
                border: '1px solid var(--border-light)',
                borderRadius: '12px',
                padding: '2rem',
                marginBottom: '2rem'
              }}>
                <h2 style={{ fontSize: '1.25rem', marginBottom: '1rem' }}>Competitors</h2>
                {deal.competitors && deal.competitors.competitors && deal.competitors.competitors.length > 0 ? (
                  <div style={{ display: 'grid', gap: '0.75rem' }}>
                    {deal.competitors.competitors.map((c, idx) => (
                      <div key={idx} style={{
                        padding: '1rem',
                        background: 'var(--border-light)',
                        borderRadius: '8px'
                      }}>
                        <div style={{ fontWeight: 600 }}>{c.name}</div>
                        {c.description && <div style={{ color: 'var(--text-secondary)', marginTop: '0.25rem' }}>{c.description}</div>}
                        <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem', flexWrap: 'wrap' }}>
                          {c.website && (
                            <a href={c.website} target="_blank" rel="noopener noreferrer" style={{ fontSize: '0.9rem' }}>Website</a>
                          )}
                          {c.market && (
                            <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>{c.market}</span>
                          )}
                        </div>
                        {(Array.isArray(c.strengths) && c.strengths.length > 0) && (
                          <div style={{ marginTop: '0.5rem' }}>
                            <div style={{ fontSize: '0.9rem', fontWeight: 600 }}>Strengths</div>
                            <ul style={{ margin: 0, paddingLeft: '1rem' }}>
                              {c.strengths.map((s, i) => (
                                <li key={i} style={{ color: 'var(--text-secondary)' }}>{s}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                        {(Array.isArray(c.weaknesses) && c.weaknesses.length > 0) && (
                          <div style={{ marginTop: '0.5rem' }}>
                            <div style={{ fontSize: '0.9rem', fontWeight: 600 }}>Weaknesses</div>
                            <ul style={{ margin: 0, paddingLeft: '1rem' }}>
                              {c.weaknesses.map((w, i) => (
                                <li key={i} style={{ color: 'var(--text-secondary)' }}>{w}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div>
                    {competitorStatus ? (
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <div style={{
                            width: '10px', height: '10px', borderRadius: '50%',
                            background: (competitorStatus.progress || 0) < 100 ? '#F59E0B' : '#10B981'
                          }} />
                          <span style={{ color: 'var(--text-secondary)' }}>{competitorStatus.label || 'Processing...'}</span>
                        </div>
                        <div style={{ height: '8px', background: 'var(--border-light)', borderRadius: '999px', marginTop: '0.5rem' }}>
                          <div style={{ height: '8px', background: 'var(--credo-orange)', width: `${Math.min(competitorStatus.progress || 0, 100)}%`, borderRadius: '999px' }} />
                        </div>
                      </div>
                    ) : (
                      <span style={{ color: 'var(--text-secondary)' }}>No competitors yet. Processing will begin shortly.</span>
                    )}
                  </div>
                )}
              </div>
              {/* Description */}
              {deal.description && (
                <div style={{
                  background: 'white',
                  border: '1px solid var(--border-light)',
                  borderRadius: '12px',
                  padding: '2rem',
                  marginBottom: '2rem'
                }}>
                  <h2 style={{ fontSize: '1.25rem', marginBottom: '1rem' }}>Description</h2>
                  <p style={{ lineHeight: '1.6', color: 'var(--text-secondary)' }}>
                    {deal.description}
                  </p>
                </div>
              )}

              {/* Uploaded Text */}
              {deal.uploadedText && (
                <div style={{
                  background: 'white',
                  border: '1px solid var(--border-light)',
                  borderRadius: '12px',
                  padding: '2rem',
                  marginBottom: '2rem'
                }}>
                  <h2 style={{ fontSize: '1.25rem', marginBottom: '1rem' }}>Additional Context</h2>
                  <p style={{ lineHeight: '1.6', color: 'var(--text-secondary)' }}>
                    {deal.uploadedText}
                  </p>
                </div>
              )}

              {/* Founding Team */}
              {deal.foundingTeam && Array.isArray(deal.foundingTeam) && deal.foundingTeam.length > 0 && (
                <div style={{
                  background: 'white',
                  border: '1px solid var(--border-light)',
                  borderRadius: '12px',
                  padding: '2rem'
                }}>
                  <h2 style={{ fontSize: '1.25rem', marginBottom: '1rem' }}>Founding Team</h2>
                  <div style={{ display: 'grid', gap: '1rem' }}>
                    {deal.foundingTeam.map((member, index) => (
                      <div key={index} style={{
                        padding: '1rem',
                        background: 'var(--border-light)',
                        borderRadius: '8px'
                      }}>
                        <div style={{ fontWeight: '600', marginBottom: '0.5rem' }}>
                          {member.name || 'Unknown'}
                        </div>
                        <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '0.5rem' }}>
                          {member.role || 'Unknown Role'}
                        </div>
                        <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                          {member.description || 'No description available'}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Sidebar */}
            <div>
              {/* Files */}
              {deal.files && deal.files.length > 0 && (
                <div style={{
                  background: 'white',
                  border: '1px solid var(--border-light)',
                  borderRadius: '12px',
                  padding: '2rem'
                }}>
                  <h3 style={{ fontSize: '1.1rem', marginBottom: '1rem' }}>Documents</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {deal.files.map((file) => (
                      <a
                        key={file.id}
                        href={file.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          display: 'block',
                          width: '100%',
                          padding: '0.75rem',
                          background: 'var(--border-light)',
                          border: 'none',
                          borderRadius: '6px',
                          textAlign: 'left',
                          cursor: 'pointer',
                          fontSize: '0.9rem',
                          color: 'var(--text-primary)',
                          textDecoration: 'none'
                        }}
                      >
                        📄 {file.originalName}
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            background: 'white',
            borderRadius: '12px',
            padding: '2rem',
            width: '90%',
            maxWidth: '400px'
          }}>
            <h3 style={{ marginBottom: '1rem' }}>Delete Deal</h3>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem' }}>
              Are you sure you want to delete this deal? This action cannot be undone.
            </p>

            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setShowDeleteConfirm(false)}
                style={{
                  padding: '0.75rem 1.5rem',
                  background: 'var(--border-light)',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                style={{
                  padding: '0.75rem 1.5rem',
                  background: '#EF4444',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer'
                }}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
