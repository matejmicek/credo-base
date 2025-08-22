import Header from "../../components/Header";

export default function DealPipeline() {
  return (
    <div>
      <Header />
      <main className="container" style={{ padding: '2rem 0' }}>
        <h1 style={{ marginBottom: '2rem', fontSize: '2.5rem' }}>Deal Pipeline</h1>
        <div style={{ 
          background: 'white', 
          padding: '2rem', 
          borderRadius: '8px',
          border: '1px solid var(--border-light)'
        }}>
          <p>Manage deal flow, track prospects, and monitor investment opportunities.</p>
          <div style={{ marginTop: '2rem' }}>
            <h3>Coming Soon:</h3>
            <ul style={{ marginTop: '1rem', paddingLeft: '1.5rem' }}>
              <li>Deal flow tracking</li>
              <li>Due diligence management</li>
              <li>Investment committee prep</li>
              <li>Deal scoring and evaluation</li>
            </ul>
          </div>
        </div>
      </main>
    </div>
  );
}