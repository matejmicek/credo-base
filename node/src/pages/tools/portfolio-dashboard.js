import Header from "../../components/Header";

export default function PortfolioDashboard() {
  return (
    <div>
      <Header />
      <main className="container" style={{ padding: '2rem 0' }}>
        <h1 style={{ marginBottom: '2rem', fontSize: '2.5rem' }}>Portfolio Dashboard</h1>
        <div style={{ 
          background: 'white', 
          padding: '2rem', 
          borderRadius: '8px',
          border: '1px solid var(--border-light)'
        }}>
          <p>Track and manage portfolio companies, investments, and performance metrics.</p>
          <div style={{ marginTop: '2rem' }}>
            <h3>Coming Soon:</h3>
            <ul style={{ marginTop: '1rem', paddingLeft: '1.5rem' }}>
              <li>Portfolio company overview</li>
              <li>Investment tracking</li>
              <li>Performance metrics</li>
              <li>Financial reports</li>
            </ul>
          </div>
        </div>
      </main>
    </div>
  );
}