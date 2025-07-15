import React, { useCallback, useMemo, useRef, useEffect } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Group, Vector3 } from 'three';
import TWEEN from '@tweenjs/tween.js';
import { OrbitControls, Environment } from '@react-three/drei';
import { useNavigate } from 'react-router-dom';
import Model from '../../components/shared/Model';
import { CollectionData } from '../../api/collections';

interface Props {
    collections: CollectionData[];
    currentIndex: number;
    username: string;
}

export const CanvasScene: React.FC<Props> = ({ collections, currentIndex, username }) => {
    const navigate = useNavigate();
    const tileRefs = useRef<Group[]>([]);

    const addToRefs = useCallback((el: Group | null) => {
        if (el && !tileRefs.current.includes(el)) tileRefs.current.push(el);
    }, []);

    const radius = useMemo(() => 1 + (collections.length - 1) * 0.5, [collections.length]);
    const step = 0.4;
    const targetPos = useCallback((i: number) => {
        const angle = (i - currentIndex) * step;
        return new Vector3(
            radius * Math.sin(angle),
            0,
            radius * Math.cos(angle) - radius
        );
    }, [currentIndex, radius]);

    useEffect(() => {
        tileRefs.current.forEach((tile, i) => {
            const dest = targetPos(i);
            new TWEEN.Tween(tile.position)
                .to({ x: dest.x, y: dest.y, z: dest.z }, 600)
                .easing(TWEEN.Easing.Quadratic.Out)
                .start();
        });
    }, [currentIndex, targetPos]);

    return (
        <Canvas camera={{ position: [0, 0.6, 1.4], fov: 60 }} shadows style={{ width: '100%', height: '100%' }}>
            <color attach="background" args={['#111']} />
            <Environment preset="sunset" resolution={32} background={false} blur={1} />
            <TWEENUpdater />
            <group>
                {collections.map((c, i) => (
                    <Model
                        key={c.user_collection_id}
                        ref={addToRefs}
                        initialPosition={targetPos(i).toArray()}
                        scaleX={0.7}
                        scaleY={0.9}
                        scaleZ={0.6}
                        label={c.label}
                        color={c.color}
                        cardStackStateIndex={c.cardStackStateIndex}
                        onClick={() => navigate(`/${username}/collection/${c.user_collection_id}`)}
                    />
                ))}
            </group>
            <OrbitControls enabled={false} />
        </Canvas>
    );
};

const TWEENUpdater: React.FC = () => {
    useFrame(() => TWEEN.update());
    return null;
};
