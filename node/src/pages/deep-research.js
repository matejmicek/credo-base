import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/router'
import Header from "../components/Header"

export default function DeepResearch() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [deals, setDeals] = useState([])
  const [showUploadModal, setShowUploadModal] = useState(false)
  const [uploadedFiles, setUploadedFiles] = useState([])
  const [freeText, setFreeText] = useState('')
  const [isProcessing, setIsProcessing] = useState(false)
  const [processingStep, setProcessingStep] = useState('')
  const [uploadProgress, setUploadProgress] = useState(0)
  const [fileSizeError, setFileSizeError] = useState('')
  const [deletingDealId, setDeletingDealId] = useState(null)

  // Fetch deals from database
  useEffect(() => {
    const fetchDeals = async () => {
      if (!session) {
        return
      }

      try {
        const response = await fetch('/api/deals', {
          method: 'GET',
          // NextAuth automatically includes session cookies
        })

        if (response.ok) {
          const dealsData = await response.json()
          setDeals(dealsData.map(deal => ({
            ...deal,
            createdAt: new Date(deal.createdAt)
          })))
        }
      } catch (error) {
        console.error('Error fetching deals:', error)
        // Fallback to mock data if API fails
        setDeals([
          {
            id: 'mock1',
            companyName: 'TechFlow AI',
            description: 'AI-powered workflow automation for enterprises',
            createdAt: new Date('2024-01-15')
          }
        ])
      }
    }

    if (session) {
      fetchDeals()
    }
  }, [session])

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

  const handleFileUpload = (event) => {
    const files = Array.from(event.target.files)
    const maxFileSize = 150 * 1024 * 1024 // 150MB in bytes

    // Check file sizes
    const oversizedFiles = files.filter(file => file.size > maxFileSize)
    if (oversizedFiles.length > 0) {
      setFileSizeError(`File "${oversizedFiles[0].name}" is too large. Maximum file size is 150MB.`)
      return
    }

    // Clear any previous errors
    setFileSizeError('')

    setUploadedFiles(prev => [...prev, ...files])
  }

  const removeFile = (index) => {
    setUploadedFiles(prev => prev.filter((_, i) => i !== index))
  }

  const handleDeleteDeal = async (dealId) => {
    try {
      const response = await fetch(`/api/deals?id=${dealId}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        // Remove the deal from the local state
        setDeals(prev => prev.filter(deal => deal.id !== dealId))
        setDeletingDealId(null)
      } else {
        console.error('Failed to delete deal')
      }
    } catch (error) {
      console.error('Error deleting deal:', error)
    }
  }

  const truncateText = (text, maxLength = 120) => {
    if (!text) return 'No description available'
    if (text.length <= maxLength) return text
    return text.substring(0, maxLength) + '...'
  }

  const handleSubmit = async () => {
    if (!session) {
      setProcessingStep('Please log in to upload files')
      setTimeout(() => setIsProcessing(false), 2000)
      return
    }

    setIsProcessing(true)
    setUploadProgress(0)
    setProcessingStep('Validating files...')

    try {
      // Create FormData for file upload
      const formData = new FormData()
      uploadedFiles.forEach((file) => {
        formData.append('files', file)
      })
      if (freeText) {
        formData.append('freeText', freeText)
      }

      setProcessingStep('Uploading files to OpenAI...')
      setUploadProgress(25)

      // Submit to upload API with authentication
      const response = await fetch('/api/deals/upload', {
        method: 'POST',
        body: formData,
        headers: {
          // NextAuth automatically includes the session token in cookies
          // No need to manually add Authorization header for client-side requests
        }
      })

      if (!response.ok) {
        throw new Error('Upload failed')
      }

      setProcessingStep('Processing files with AI...')
      setUploadProgress(50)

      const result = await response.json()

      setProcessingStep('Analyzing documents...')
      setUploadProgress(75)

      await new Promise(resolve => setTimeout(resolve, 1500))

      setProcessingStep('Creating deal profile...')
      setUploadProgress(90)

      await new Promise(resolve => setTimeout(resolve, 1000))

      setProcessingStep('Complete!')
      setUploadProgress(100)

      // Add the new deal to the list
      const newDeal = {
        ...result.deal,
        createdAt: new Date(result.deal.createdAt)
      }

      setDeals(prev => [newDeal, ...prev])

      // Reset form after a short delay
      setTimeout(() => {
        setIsProcessing(false)
        setShowUploadModal(false)
        setUploadedFiles([])
        setFreeText('')
        setUploadProgress(0)
        setProcessingStep('')
      }, 1500)

    } catch (error) {
      console.error('Error creating deal:', error)
      setProcessingStep('Error occurred. Please try again.')
      setUploadProgress(0)
      setTimeout(() => {
        setIsProcessing(false)
      }, 3000)
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

  return (
    <div>
      <Header />
      <main className="container" style={{ padding: '2rem 0', minHeight: '80vh' }}>
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          marginBottom: '2rem' 
        }}>
          <div>
            <h1 style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>
              Credo Deep Research
            </h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: '1.1rem' }}>
              AI-powered deal analysis and research
            </p>
          </div>
          
          <button 
            onClick={() => setShowUploadModal(true)}
            className="btn-primary"
            style={{ 
              padding: '1rem 2rem',
              fontSize: '1rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}
          >
            <span style={{ fontSize: '1.2rem' }}>+</span>
            Create New Deal
          </button>
        </div>

        {/* Deals Grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))',
          gap: '1.5rem'
        }}>
          {deals.map(deal => (
            <div
              key={deal.id}
              style={{
                background: 'white',
                border: '1px solid var(--border-light)',
                borderRadius: '12px',
                padding: '1.5rem',
                transition: 'all 0.2s ease',
                cursor: 'pointer',
                position: 'relative'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)'
                e.currentTarget.style.transform = 'translateY(-2px)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.boxShadow = 'none'
                e.currentTarget.style.transform = 'translateY(0)'
              }}
              onClick={(e) => {
                // Don't navigate if clicking delete button
                if (e.target.closest('.delete-btn')) return
                router.push(`/deep-research/${deal.id}`)
              }}
            >
              {/* Delete Button */}
              <button
                className="delete-btn"
                onClick={(e) => {
                  e.stopPropagation()
                  setDeletingDealId(deal.id)
                }}
                style={{
                  position: 'absolute',
                  top: '1rem',
                  right: '1rem',
                  background: '#EF4444',
                  color: 'white',
                  border: 'none',
                  borderRadius: '50%',
                  width: '28px',
                  height: '28px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  fontSize: '14px',
                  zIndex: 10
                }}
              >
                ×
              </button>

              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                marginBottom: '1rem',
                paddingRight: '2rem' // Make room for delete button
              }}>
                <h3 style={{ fontSize: '1.25rem', fontWeight: '600' }}>
                  {deal.companyName}
                </h3>
              </div>

              <p style={{
                color: 'var(--text-secondary)',
                marginBottom: '1rem',
                lineHeight: '1.5'
              }}>
                {truncateText(deal.description)}
              </p>

              <div style={{
                display: 'flex',
                justifyContent: 'flex-end',
                alignItems: 'center',
                fontSize: '0.9rem',
                color: 'var(--text-light)'
              }}>
                <div>
                  {deal.createdAt.toLocaleDateString()}
                </div>
              </div>

              {deal.files && deal.files.length > 0 && (
                <div style={{
                  marginTop: '1rem',
                  fontSize: '0.8rem',
                  color: 'var(--text-light)'
                }}>
                  📄 {deal.files.length} document{deal.files.length !== 1 ? 's' : ''}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Upload Modal */}
        {showUploadModal && (
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
              borderRadius: '16px',
              width: '90%',
              maxWidth: '600px',
              maxHeight: '90vh',
              overflow: 'auto',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)'
            }}>
              {!isProcessing ? (
                <div style={{ padding: '2rem' }}>
                  <div style={{ 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'center',
                    marginBottom: '2rem'
                  }}>
                    <h2 style={{ fontSize: '1.5rem', fontWeight: '600' }}>
                      Create New Deal
                    </h2>
                    <button 
                      onClick={() => setShowUploadModal(false)}
                      style={{
                        background: 'none',
                        border: 'none',
                        fontSize: '1.5rem',
                        cursor: 'pointer',
                        color: 'var(--text-light)'
                      }}
                    >
                      ×
                    </button>
                  </div>

                  {/* File Upload Area */}
                  <div style={{
                    border: fileSizeError ? '2px dashed var(--credo-orange)' : '2px dashed var(--border-light)',
                    borderRadius: '12px',
                    padding: '2rem',
                    textAlign: 'center',
                    marginBottom: '1.5rem',
                    background: fileSizeError ? 'rgba(251, 146, 60, 0.1)' : 'var(--credo-orange-light)'
                  }}>
                    <input
                      type="file"
                      multiple
                      accept=".pdf"
                      onChange={handleFileUpload}
                      style={{ display: 'none' }}
                      id="file-upload"
                    />
                    <label
                      htmlFor="file-upload"
                      style={{
                        cursor: 'pointer',
                        display: 'block'
                      }}
                    >
                      <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>📎</div>
                      <p style={{ fontSize: '1.1rem', fontWeight: '500', marginBottom: '0.5rem' }}>
                        Upload Documents
                      </p>
                      <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                        PDF only (max 150MB each)
                      </p>
                      {fileSizeError && (
                        <p style={{
                          color: 'var(--credo-orange)',
                          fontSize: '0.9rem',
                          fontWeight: '500',
                          marginTop: '0.5rem'
                        }}>
                          ⚠️ {fileSizeError}
                        </p>
                      )}
                    </label>
                  </div>

                  {/* Uploaded Files */}
                  {uploadedFiles.length > 0 && (
                    <div style={{ marginBottom: '1.5rem' }}>
                      <h4 style={{ marginBottom: '1rem', fontSize: '0.9rem', fontWeight: '600' }}>
                        Uploaded Files:
                      </h4>
                      {uploadedFiles.map((file, index) => (
                        <div 
                          key={index}
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            padding: '0.75rem',
                            background: 'var(--border-light)',
                            borderRadius: '8px',
                            marginBottom: '0.5rem'
                          }}
                        >
                          <span style={{ fontSize: '0.9rem' }}>{file.name}</span>
                          <button 
                            onClick={() => removeFile(index)}
                            style={{
                              background: 'none',
                              border: 'none',
                              color: 'var(--text-light)',
                              cursor: 'pointer'
                            }}
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Free Text Input */}
                  <div style={{ marginBottom: '2rem' }}>
                    <label style={{ 
                      display: 'block', 
                      marginBottom: '0.5rem',
                      fontSize: '0.9rem',
                      fontWeight: '600'
                    }}>
                      Additional Information
                    </label>
                    <textarea
                      value={freeText}
                      onChange={(e) => setFreeText(e.target.value)}
                      placeholder="Company description, key insights, or any additional context..."
                      style={{
                        width: '100%',
                        minHeight: '100px',
                        padding: '1rem',
                        border: '1px solid var(--border-light)',
                        borderRadius: '8px',
                        fontSize: '0.9rem',
                        fontFamily: 'inherit',
                        resize: 'vertical'
                      }}
                    />
                  </div>

                  {/* Submit Button */}
                  <button
                    onClick={handleSubmit}
                    className="btn-primary"
                    disabled={(uploadedFiles.length === 0 && !freeText.trim()) || !!fileSizeError}
                    style={{
                      width: '100%',
                      padding: '1rem',
                      fontSize: '1rem',
                      opacity: ((uploadedFiles.length === 0 && !freeText.trim()) || !!fileSizeError) ? 0.5 : 1
                    }}
                  >
                    Continue
                  </button>
                </div>
              ) : (
                <div style={{
                  padding: '3rem 2rem',
                  textAlign: 'center'
                }}>
                  <div style={{
                    width: '60px',
                    height: '60px',
                    border: '3px solid var(--border-light)',
                    borderTop: '3px solid var(--credo-orange)',
                    borderRadius: '50%',
                    animation: 'spin 1s linear infinite',
                    margin: '0 auto 2rem'
                  }}></div>

                  <h3 style={{ marginBottom: '1rem', fontSize: '1.25rem' }}>
                    Processing with AI
                  </h3>

                  {/* Progress Bar */}
                  <div style={{
                    width: '100%',
                    height: '8px',
                    background: 'var(--border-light)',
                    borderRadius: '4px',
                    marginBottom: '1.5rem',
                    overflow: 'hidden'
                  }}>
                    <div style={{
                      width: `${uploadProgress}%`,
                      height: '100%',
                      background: 'linear-gradient(90deg, var(--credo-orange), var(--credo-orange-light))',
                      borderRadius: '4px',
                      transition: 'width 0.5s ease-in-out'
                    }}></div>
                  </div>

                  <p style={{ color: 'var(--text-secondary)' }}>
                    {processingStep}
                  </p>

                  <div style={{
                    marginTop: '1rem',
                    fontSize: '0.9rem',
                    color: 'var(--text-light)'
                  }}>
                    {uploadProgress}% complete
                  </div>

                  <style jsx>{`
                    @keyframes spin {
                      0% { transform: rotate(0deg); }
                      100% { transform: rotate(360deg); }
                    }
                  `}</style>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Delete Confirmation Modal */}
        {deletingDealId && (
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
                  onClick={() => setDeletingDealId(null)}
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
                  onClick={() => handleDeleteDeal(deletingDealId)}
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
      </main>
    </div>
  )
}