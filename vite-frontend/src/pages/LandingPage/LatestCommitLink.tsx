import React, { useEffect, useState } from 'react'
import { Link } from '@mui/material'

interface Commit {
  sha: string
  html_url: string
  commit: {
    message: string
    author: {
      date: string
      name: string
    }
  }
}

const GITHUB_API_URL =
  'https://api.github.com/repos/mtgscan-cards/monolithic/commits?sha=prod&per_page=1'

const LatestCommitLink: React.FC = () => {
  const [commit, setCommit] = useState<Commit | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(GITHUB_API_URL)
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data) && data.length > 0) {
          setCommit(data[0])
        }
      })
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <span>Loading commit…</span>
  if (!commit) return <span>—</span>

  return (
    <Link
      href={commit.html_url}
      target="_blank"
      rel="noopener noreferrer"
      underline="hover"
      color="inherit"
      sx={{ fontSize: 'inherit' }}
    >
      commit {commit.sha.substring(0, 7)}
    </Link>
  )
}

export default LatestCommitLink