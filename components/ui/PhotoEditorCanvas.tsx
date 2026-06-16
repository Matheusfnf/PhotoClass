import React, { useRef, useState, useEffect } from 'react';
import { View, StyleSheet, PanResponder } from 'react-native';
import Svg, { Path } from 'react-native-svg';

export interface Point {
  x: number;
  y: number;
}

export interface DrawingPath {
  points: Point[];
  color: string;
  strokeWidth: number;
}

interface PhotoEditorCanvasProps {
  currentColor?: string;
  currentStrokeWidth?: number;
  undoTrigger?: number; // increment this to trigger undo
}

export function PhotoEditorCanvas({ 
  currentColor = '#FF3B30', 
  currentStrokeWidth = 6,
  undoTrigger = 0
}: PhotoEditorCanvasProps) {
  const [paths, setPaths] = useState<DrawingPath[]>([]);
  const currentPath = useRef<DrawingPath | null>(null);

  // Keep a ref to the latest visual props so PanResponder doesn't trap old closures
  const settingsRef = useRef({ color: currentColor, strokeWidth: currentStrokeWidth });
  useEffect(() => {
    settingsRef.current = { color: currentColor, strokeWidth: currentStrokeWidth };
  }, [currentColor, currentStrokeWidth]);

  useEffect(() => {
    if (undoTrigger > 0) {
      setPaths(prev => prev.slice(0, -1));
    }
  }, [undoTrigger]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (evt) => {
        const { locationX, locationY } = evt.nativeEvent;
        // Start a new path
        const newPath: DrawingPath = {
          points: [{ x: locationX, y: locationY }],
          color: settingsRef.current.color,
          strokeWidth: settingsRef.current.strokeWidth,
        };
        currentPath.current = newPath;
        setPaths(prev => [...prev, newPath]);
      },
      onPanResponderMove: (evt) => {
        if (!currentPath.current) return;
        const { locationX, locationY } = evt.nativeEvent;
        
        currentPath.current.points.push({ x: locationX, y: locationY });
        
        // Impulsiona um re-render sem depender do currentPath.current (que as vezes fica null no exato millissegundo que você solta o dedo, criando um gap assíncrono no React)
        setPaths(prev => {
          if (prev.length === 0) return prev;
          const newPaths = [...prev];
          // Apenas renova a referência da memória local para a GPU acordar e renderizar os novos pontos que inserimos
          newPaths[newPaths.length - 1] = { ...newPaths[newPaths.length - 1] };
          return newPaths;
        });
      },
      onPanResponderRelease: () => {
        // Path sequence complete
        currentPath.current = null;
      },
      onPanResponderTerminate: () => {
        currentPath.current = null;
      }
    })
  ).current;

  const createSvgPath = (points?: Point[]) => {
    if (!points || points.length === 0) return '';
    const start = points[0];
    let pathStr = `M ${start.x} ${start.y}`;
    for (let i = 1; i < points.length; i++) {
        // Simplistic bezier could go here, but for Instagram style, heavy points rate = L is fine enough
      pathStr += ` L ${points[i].x} ${points[i].y}`;
    }
    return pathStr;
  };

  return (
    <View style={StyleSheet.absoluteFillObject} {...panResponder.panHandlers}>
      <Svg style={StyleSheet.absoluteFillObject}>
        {paths.map((p, index) => (
          <Path
            key={index}
            d={createSvgPath(p.points)}
            stroke={p.color}
            strokeWidth={p.strokeWidth}
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ))}
      </Svg>
    </View>
  );
}
