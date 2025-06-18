import React from 'react'

const Footer: React.FC = () => {
  return (
    <footer
      style={{
        width: '100%',
        padding: '2rem 1rem',
        backgroundColor: '#0d0d0d',
        color: '#888',
        textAlign: 'center',
        fontSize: '0.9rem',
        borderTop: '1px solid #222',
      }}
    >
      <p>© {new Date().getFullYear()} MTGScan.cards — Built for collectors, by collectors.</p>
    </footer>
  )
}

export default Footer
