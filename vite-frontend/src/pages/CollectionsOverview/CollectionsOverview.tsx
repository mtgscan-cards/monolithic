import React, {
  useState,
  useRef,
  useCallback,
  useEffect,
  useMemo,
  useContext,
  MutableRefObject,
  FC,
} from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls, Environment, useGLTF } from '@react-three/drei'
import { Group, Vector3 } from 'three'
import TWEEN from '@tweenjs/tween.js'
import { useNavigate } from 'react-router-dom'
import {
  Paper,
  Box,
  TextField,
  Button,
  Typography,
  Grid,
  CircularProgress,
} from '@mui/material'

import Model from '../../components/shared/Model'
import { createCollection, getCollections, CollectionData } from '../../api/collections'
import { AuthContext } from '../../contexts/AuthContext'


const PreloadModels: FC = () => {
  useGLTF.preload('mtgcardstack_min.glb')
  useGLTF.preload('compressed_box.glb')
  return null
}

type GroupArrayRef = MutableRefObject<Group[]>

const CollectionsOverview: React.FC = () => {
  const { user } = useContext(AuthContext)
  const navigate = useNavigate()

  const [collections, setCollections] = useState<CollectionData[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [currentIndex, setCurrentIndex] = useState(0)

  const [label, setLabel] = useState('New Collection')
  const [topColor, setTopColor] = useState('#ffffff')
  const [bottomColor, setBottomColor] = useState('#8b4513')

  const tileRefs: GroupArrayRef = useRef([])

  useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        const data = await getCollections()
        if (mounted) setCollections(data)
      } catch (e) {
        console.error('Error loading collections:', e)
      } finally {
        if (mounted) setIsLoading(false)
      }
    })()
    return () => { mounted = false }
  }, [])

  const radius = useMemo(
    () => 1 + (collections.length > 1 ? (collections.length - 1) * 0.5 : 0),
    [collections.length],
  )
  const step = 0.4
  const targetPos = useCallback(
    (i: number) => {
      const angle = (i - currentIndex) * step
      return new Vector3(
        radius * Math.sin(angle),
        0,
        radius * Math.cos(angle) - radius,
      )
    },
    [currentIndex, radius],
  )

  useEffect(() => {
    tileRefs.current.forEach((tile, i) => {
      const dest = targetPos(i)
      new TWEEN.Tween(tile.position)
        .to({ x: dest.x, y: dest.y, z: dest.z }, 600)
        .easing(TWEEN.Easing.Quadratic.Out)
        .start()
    })
  }, [currentIndex, targetPos])

  const addToRefs = useCallback(
    (el: Group | null) => {
      if (el && !tileRefs.current.includes(el)) tileRefs.current.push(el)
    },
    [tileRefs],
  )

  const atStart = currentIndex === 0
  const atEnd = collections.length === 0 || currentIndex === collections.length - 1
  const prev = () => !atStart && setCurrentIndex(i => i - 1)
  const next = () => !atEnd && setCurrentIndex(i => i + 1)

  const handleAdd = async () => {
    try {
      const newCol = await createCollection({
        label,
        cardStackStateIndex: 0,
        color: {
          top: parseInt(topColor.slice(1), 16),
          bottom: parseInt(bottomColor.slice(1), 16),
        },
      })
      setCollections(prev => [...prev, newCol])
      setCurrentIndex(collections.length)
    } catch (e) {
      console.error('Create collection failed:', e)
    }
  }

  if (!user) return null
  const username = user.username

  return (
    <Box
      sx={{
        width: '100%',
        minHeight: '100vh',
        maxHeight: '100vh',
        overflow: 'hidden',
        position: 'relative',
        backgroundColor: '#111111',
      }}
    >
      <PreloadModels />

      <Box
        sx={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          zIndex: 0,
        }}
      >
        <Canvas
          camera={{ position: [0, 0.6, 1.4], fov: 60 }}
          shadows
        >
          <color attach="background" args={['#111111']} />
          <Environment preset="sunset" resolution={32} background={false} blur={1} />
          <TWEENUpdater />
          <group>
            {collections.map((c, i) => (
              <Model
                key={c.user_collection_id}
                ref={addToRefs}
                initialPosition={[...targetPos(i).toArray()]}
                scaleX={0.7}
                scaleY={0.9}
                scaleZ={0.6}
                label={c.label}
                color={c.color}
                cardStackStateIndex={c.cardStackStateIndex}
                onClick={() =>
                  navigate(`/${username}/collection/${c.user_collection_id}`)
                }
              />
            ))}
          </group>
          <OrbitControls enabled={false} />
        </Canvas>
      </Box>

      {isLoading && (
        <FullOverlay>
          <CircularProgress color="secondary" />
        </FullOverlay>
      )}

      {!isLoading && collections.length === 0 && (
        <Banner>
          <Typography variant="h5">No collections yet</Typography>
          <Typography>Create one below to get started!</Typography>
        </Banner>
      )}

      <NavButton disabled={atStart} onClick={prev}>◀</NavButton>
      <NavButton right disabled={atEnd} onClick={next}>▶</NavButton>

      <Paper
        elevation={4}
        sx={{
          position: 'absolute',
          bottom: 120,
          left: '50%',
          transform: 'translateX(-50%)',
          width: { xs: '90%', sm: 400 },
          maxHeight: '50vh',
          overflowY: 'auto',
          p: 3,
          bgcolor: 'rgba(0,0,0,0.75)',
          color: 'white',
          borderRadius: 2,
          zIndex: 1,
        }}
      >
        <Typography variant="h6" gutterBottom>
          Create New Collection
        </Typography>
        <Grid container spacing={2}>
          <Grid item xs={12}>
            <TextField
              label="Label"
              fullWidth
              variant="filled"
              value={label}
              onChange={e => setLabel(e.target.value)}
            />
          </Grid>
          <Grid item xs={6}>
            <TextField
              label="Top Color"
              type="color"
              fullWidth
              variant="filled"
              value={topColor}
              onChange={e => setTopColor(e.target.value)}
              InputLabelProps={{ shrink: true }}
            />
          </Grid>
          <Grid item xs={6}>
            <TextField
              label="Bottom Color"
              type="color"
              fullWidth
              variant="filled"
              value={bottomColor}
              onChange={e => setBottomColor(e.target.value)}
              InputLabelProps={{ shrink: true }}
            />
          </Grid>
          <Grid item xs={12}>
            <Button onClick={handleAdd} variant="contained" fullWidth>
              Create Collection
            </Button>
          </Grid>
        </Grid>
      </Paper>
    </Box>
  )
}

const TWEENUpdater: React.FC = () => {
  useFrame(() => TWEEN.update())
  return null
}

const FullOverlay: React.FC<React.PropsWithChildren> = ({ children }) => (
  <Box
    sx={{
      position: 'absolute',
      inset: 0,
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      bgcolor: 'rgba(0,0,0,0.6)',
      zIndex: 1,
    }}
  >
    {children}
  </Box>
)

const Banner: React.FC<React.PropsWithChildren> = ({ children }) => (
  <Box
    sx={{
      position: 'absolute',
      top: 80,
      left: '50%',
      transform: 'translateX(-50%)',
      px: 3,
      py: 2,
      bgcolor: 'rgba(0,0,0,0.75)',
      borderRadius: 2,
      color: 'white',
      textAlign: 'center',
      zIndex: 1,
    }}
  >
    {children}
  </Box>
)

interface NavButtonProps {
  right?: boolean
  disabled?: boolean
  onClick: () => void
}

const NavButton: React.FC<React.PropsWithChildren<NavButtonProps>> = ({
  right = false,
  disabled,
  onClick,
  children,
}) => (
  <Button
    disabled={disabled}
    onClick={onClick}
    sx={{
      position: 'absolute',
      top: '50%',
      transform: 'translateY(-50%)',
      [right ? 'right' : 'left']: 16,
      fontSize: '2rem',
      color: 'white',
      minWidth: 0,
      opacity: disabled ? 0.3 : 1,
      pointerEvents: disabled ? 'none' : 'auto',
      zIndex: 1,
    }}
  >
    {children}
  </Button>
)

export default CollectionsOverview
