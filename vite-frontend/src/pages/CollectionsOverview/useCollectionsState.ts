// vite-frontend/src/pages/CollectionsOverview/useCollectionsState.ts

import { useEffect, useState, useCallback, RefObject } from 'react';
import { createCollection, getCollections, CollectionData } from '../../api/collections';

export function useCollectionsState(canvasWrapperRef: RefObject<HTMLDivElement | null>) {
    const [collections, setCollections] = useState<CollectionData[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [readyToRender3D, setReadyToRender3D] = useState(false);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [label, setLabel] = useState('New Collection');
    const [topColor, setTopColor] = useState('#ffffff');
    const [bottomColor, setBottomColor] = useState('#8b4513');

    useEffect(() => {
        let mounted = true;
        (async () => {
            try {
                const data = await getCollections();
                if (mounted) setCollections(data);
            } catch {
                // silent fail
            } finally {
                if (mounted) setIsLoading(false);
            }
        })();
        return () => {
            mounted = false;
        };
    }, []);

    useEffect(() => {
        const id = requestIdleCallback(() => setReadyToRender3D(true), { timeout: 100 });
        return () => cancelIdleCallback(id);
    }, []);

    useEffect(() => {
        if (!isLoading && readyToRender3D) {
            requestAnimationFrame(() => {
                const canvas = canvasWrapperRef.current?.querySelector('canvas');
                canvas?.classList.add('fade-canvas', 'visible');
            });
        }
    }, [isLoading, readyToRender3D, canvasWrapperRef]);

    const atStart = currentIndex === 0;
    const atEnd = collections.length === 0 || currentIndex === collections.length - 1;
    const prev = () => !atStart && setCurrentIndex((i) => i - 1);
    const next = () => !atEnd && setCurrentIndex((i) => i + 1);

    const handleAdd = useCallback(async () => {
        try {
            const newCol = await createCollection({
                label,
                cardStackStateIndex: 0,
                color: {
                    top: parseInt(topColor.slice(1), 16),
                    bottom: parseInt(bottomColor.slice(1), 16),
                },
            });
            setCollections((prev) => [...prev, newCol]);
            setCurrentIndex(collections.length);
        } catch (e) {
            console.error('Create collection failed:', e);
        }
    }, [label, topColor, bottomColor, collections.length]);

    return {
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
    };
}
