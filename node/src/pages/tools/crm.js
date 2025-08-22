import Header from "../../components/Header";

export default function CRM() {
  return (
    <div>
      <Header />
      <main className="container" style={{ padding: '2rem 0' }}>
        <h1 style={{ marginBottom: '2rem', fontSize: '2.5rem' }}>CRM</h1>
        <div style={{ 
          background: 'white', 
          padding: '2rem', 
          borderRadius: '8px',
          border: '1px solid var(--border-light)'
        }}>
          <p>Manage relationships with founders, LPs, and portfolio companies.</p>
          <div style={{ marginTop: '2rem' }}>
            <h3>Coming Soon:</h3>
            <ul style={{ marginTop: '1rem', paddingLeft: '1.5rem' }}>
              <li>Founder relationship management</li>
              <li>LP communication tracking</li>
              <li>Meeting notes and follow-ups</li>
              <li>Contact database</li>
            </ul>
          </div>
        </div>
      </main>
    </div>
  );
}