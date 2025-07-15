import React, { Suspense, useContext, useRef } from 'react';
import { Box } from '@mui/material';
import { AuthContext } from '../../contexts/AuthContext';
import { CanvasScene } from './CanvasScene';
import { FullOverlay, Banner, NavButton } from './OverlayControls';
import { CreateCollectionForm } from './CreateCollectionForm';
import { useCollectionsState } from './useCollectionsState';
//import './collectionsoverview.css';

const CollectionsOverview: React.FC = () => {
  const { user } = useContext(AuthContext);
  const canvasWrapperRef = useRef<HTMLDivElement>(null);
  const {
    collections,
    isLoading,
    readyToRender3D,
    currentIndex,
    atStart,
    atEnd,
    prev,
    next,
    handleAdd,
    label,
    topColor,
    bottomColor,
    setLabel,
    setTopColor,
    setBottomColor,
  } = useCollectionsState(canvasWrapperRef);

  if (!user) return null;
  const username = user.username;

  return (
    <Box component="main" sx={{ position: 'relative', width: '100vw', overflow: 'hidden', backgroundColor: '#111' }}>
      <Box ref={canvasWrapperRef} sx={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', zIndex: 0 }}>
        {readyToRender3D && (
          <Suspense fallback={null}>
            <CanvasScene
              collections={collections}
              currentIndex={currentIndex}
              username={username}
            />
          </Suspense>
        )}
      </Box>

      {isLoading && <FullOverlay><></></FullOverlay>}
      {!isLoading && collections.length === 0 && (
        <Banner>
          No collections yet. Create one below to get started!
        </Banner>
      )}

      <NavButton disabled={atStart} onClick={prev}>◀</NavButton>
      <NavButton right disabled={atEnd} onClick={next}>▶</NavButton>

      <CreateCollectionForm
        label={label}
        topColor={topColor}
        bottomColor={bottomColor}
        setLabel={setLabel}
        setTopColor={setTopColor}
        setBottomColor={setBottomColor}
        handleAdd={handleAdd}
      />
    </Box>
  );
};

export default CollectionsOverview;
