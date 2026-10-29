export default function LoadingSpinner({ fullPage = false, dark = false }) {
  if (fullPage) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: dark ? '#0F0F0F' : 'var(--color-bg)',
        }}
      >
        <div
          className="spinner"
          style={{
            width: 32,
            height: 32,
            borderColor: dark ? '#2A2A2A' : 'var(--color-border)',
            borderTopColor: dark ? '#FFFFFF' : 'var(--color-accent)',
          }}
        />
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem 0' }}>
      <div className="spinner" />
    </div>
  );
}
