import React from 'react'

const Footer: React.FC = () => {
  return (
    <footer
      style={{
        width: '100%',
        backgroundColor: '#0d0d0d',
        color: '#ccc',
        padding: '4rem 2rem 2rem',
        borderTop: '1px solid #222',
        fontSize: '0.9rem',
      }}
    >
      <div
        style={{
          display: 'grid',
          gridTemplateAreas: `
            "about resources community"
            "about legal legal"
          `,
          gridTemplateColumns: '2fr 1fr 1fr',
          gap: '2rem',
          maxWidth: '1200px',
          margin: '0 auto',
        }}
      >
        {/* About section */}
        <div style={{ gridArea: 'about' }}>
          <h4 style={{ color: '#fff', marginBottom: '1rem', fontSize: '1.1rem' }}>
            <span style={{ marginRight: '0.5rem' }}>📷</span>MTGScan.cards
          </h4>
          <p style={{ lineHeight: '1.6' }}>
            Built for collectors, by collectors. Scan and track your Magic: The Gathering collection with blazing-fast recognition and card data powered by modern AI.
          </p>
          <p style={{ marginTop: '1rem', color: '#666', fontSize: '0.85rem' }}>
            Version 1.0.0 • Open Source
          </p>
        </div>

        {/* Resources */}
        <div style={{ gridArea: 'resources' }}>
          <h4 style={{ color: '#fff', marginBottom: '1rem' }}>
            <span style={{ marginRight: '0.5rem' }}>📚</span>Resources
          </h4>
          <ul style={{ listStyle: 'none', padding: 0, lineHeight: '1.8' }}>
            <li><a href="#" style={{ color: '#aaa', textDecoration: 'none' }}>Documentation</a></li>
            <li><a href="#" style={{ color: '#aaa', textDecoration: 'none' }}>Developer API</a></li>
            <li><a href="#" style={{ color: '#aaa', textDecoration: 'none' }}>Changelog</a></li>
            <li><a href="#" style={{ color: '#aaa', textDecoration: 'none' }}>Support</a></li>
          </ul>
        </div>

        {/* Community */}
        <div style={{ gridArea: 'community' }}>
          <h4 style={{ color: '#fff', marginBottom: '1rem' }}>
            <span style={{ marginRight: '0.5rem' }}>🌐</span>Community
          </h4>
          <ul style={{ listStyle: 'none', padding: 0, lineHeight: '1.8' }}>
            <li><a href="#" style={{ color: '#aaa', textDecoration: 'none' }}>GitHub</a></li>
            <li><a href="#" style={{ color: '#aaa', textDecoration: 'none' }}>Discord</a></li>
            <li><a href="#" style={{ color: '#aaa', textDecoration: 'none' }}>Reddit</a></li>
            <li><a href="#" style={{ color: '#aaa', textDecoration: 'none' }}>Twitter/X</a></li>
          </ul>
        </div>

        {/* Legal */}
        <div style={{ gridArea: 'legal' }}>
          <h4 style={{ color: '#fff', marginBottom: '1rem' }}>
            <span style={{ marginRight: '0.5rem' }}>⚖️</span>Legal
          </h4>
          <ul style={{ listStyle: 'none', padding: 0, lineHeight: '1.8' }}>
            <li><a href="#" style={{ color: '#aaa', textDecoration: 'none' }}>Privacy Policy</a></li>
            <li><a href="#" style={{ color: '#aaa', textDecoration: 'none' }}>Terms of Service</a></li>
            <li><a href="#" style={{ color: '#aaa', textDecoration: 'none' }}>License</a></li>
          </ul>
        </div>
      </div>

      {/* Bottom bar */}
      <div
        style={{
          borderTop: '1px solid #222',
          marginTop: '3rem',
          paddingTop: '1.5rem',
          textAlign: 'center',
          color: '#666',
          fontSize: '0.85rem',
        }}
      >
        <p>© {new Date().getFullYear()} MTGScan.cards — All rights reserved.</p>
      </div>
    </footer>
  )
}

export default Footer
