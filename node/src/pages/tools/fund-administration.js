import Header from "../../components/Header";

export default function FundAdministration() {
  return (
    <div>
      <Header />
      <main className="container" style={{ padding: '2rem 0' }}>
        <h1 style={{ marginBottom: '2rem', fontSize: '2.5rem' }}>Fund Administration</h1>
        <div style={{ 
          background: 'white', 
          padding: '2rem', 
          borderRadius: '8px',
          border: '1px solid var(--border-light)'
        }}>
          <p>Manage fund operations, LP reporting, and administrative tasks.</p>
          <div style={{ marginTop: '2rem' }}>
            <h3>Coming Soon:</h3>
            <ul style={{ marginTop: '1rem', paddingLeft: '1.5rem' }}>
              <li>LP reporting dashboard</li>
              <li>Fund performance tracking</li>
              <li>Capital call management</li>
              <li>Distribution tracking</li>
            </ul>
          </div>
        </div>
      </main>
    </div>
  );
}