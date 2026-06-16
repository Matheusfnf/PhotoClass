import React, { useRef, useState, useEffect } from 'react';
import { View, StyleSheet, PanResponder } from 'react-native';

export type CropArea = {
  x: number;
  y: number;
  width: number;
  height: number;
};

interface PhotoCropCanvasProps {
  width: number;
  height: number;
  onCropChange: (crop: CropArea) => void;
}

const CORNER_SIZE = 40;

export const PhotoCropCanvas = ({ width, height, onCropChange }: PhotoCropCanvasProps) => {
  const [box, setBox] = useState({ left: 0, top: 0, right: 0, bottom: 0 }); // Inverted right/bottom for absolute positioning bounds

  const activeBox = useRef({ left: 0, top: 0, right: 0, bottom: 0 });

  useEffect(() => {
    // Reset on mount
    const startBox = { left: 0, top: 0, right: 0, bottom: 0 };
    setBox(startBox);
    activeBox.current = startBox;
    commitChange();
  }, [width, height]);

  const commitChange = () => {
    const { left, top, right, bottom } = activeBox.current;
    
    // Converte distâncias absolutas em proporções (0.0 a 1.0)
    onCropChange({
      x: left / width,
      y: top / height,
      width: (width - left - right) / width,
      height: (height - top - bottom) / height,
    });
  };

  const createPanResponder = (corner: 'TL' | 'TR' | 'BL' | 'BR') => {
    let startL = 0, startT = 0, startR = 0, startB = 0;
    
    return PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        startL = activeBox.current.left;
        startT = activeBox.current.top;
        startR = activeBox.current.right;
        startB = activeBox.current.bottom;
      },
      onPanResponderMove: (_, gestureState) => {
        const { dx, dy } = gestureState;
        let { left, top, right, bottom } = activeBox.current;

        const MIN_SIZE = 50; // Minimum crop size

        if (corner === 'TL') {
          left = Math.max(0, Math.min(width - right - MIN_SIZE, startL + dx));
          top = Math.max(0, Math.min(height - bottom - MIN_SIZE, startT + dy));
        } else if (corner === 'TR') {
          right = Math.max(0, Math.min(width - left - MIN_SIZE, startR - dx));
          top = Math.max(0, Math.min(height - bottom - MIN_SIZE, startT + dy));
        } else if (corner === 'BL') {
          left = Math.max(0, Math.min(width - right - MIN_SIZE, startL + dx));
          bottom = Math.max(0, Math.min(height - top - MIN_SIZE, startB - dy));
        } else if (corner === 'BR') {
          right = Math.max(0, Math.min(width - left - MIN_SIZE, startR - dx));
          bottom = Math.max(0, Math.min(height - top - MIN_SIZE, startB - dy));
        }

        activeBox.current = { left, top, right, bottom };
        setBox({ left, top, right, bottom });
      },
      onPanResponderRelease: commitChange,
      onPanResponderTerminate: commitChange,
    });
  };

  const panTL = useRef(createPanResponder('TL')).current;
  const panTR = useRef(createPanResponder('TR')).current;
  const panBL = useRef(createPanResponder('BL')).current;
  const panBR = useRef(createPanResponder('BR')).current;

  return (
    <View style={StyleSheet.absoluteFillObject} pointerEvents="box-none">
      {/* Escurecimento fora da caixa (Overlay) usando 4 barras vazadas */}
      <View style={[styles.overlay, { top: 0, left: 0, right: 0, height: box.top }]} />
      <View style={[styles.overlay, { bottom: 0, left: 0, right: 0, height: box.bottom }]} />
      <View style={[styles.overlay, { top: box.top, bottom: box.bottom, left: 0, width: box.left }]} />
      <View style={[styles.overlay, { top: box.top, bottom: box.bottom, right: 0, width: box.right }]} />

      {/* Caixa Limitadora Arrastável */}
      <View style={[styles.cropBox, { left: box.left, top: box.top, right: box.right, bottom: box.bottom }]}>
        {/* Puxadores de Canto Brancos (Touch Areas) */}
        <View style={[styles.corner, styles.cornerTL]} {...panTL.panHandlers} />
        <View style={[styles.corner, styles.cornerTR]} {...panTR.panHandlers} />
        <View style={[styles.corner, styles.cornerBL]} {...panBL.panHandlers} />
        <View style={[styles.corner, styles.cornerBR]} {...panBR.panHandlers} />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    backgroundColor: 'rgba(0,0,0,0.65)',
  },
  cropBox: {
    position: 'absolute',
    borderWidth: 1.5,
    borderColor: '#FFF',
  },
  corner: {
    position: 'absolute',
    width: CORNER_SIZE,
    height: CORNER_SIZE,
    backgroundColor: 'transparent',
  },
  cornerTL: {
    top: -10, left: -10,
    borderTopWidth: 4, borderLeftWidth: 4, borderColor: '#FFF',
  },
  cornerTR: {
    top: -10, right: -10,
    borderTopWidth: 4, borderRightWidth: 4, borderColor: '#FFF',
  },
  cornerBL: {
    bottom: -10, left: -10,
    borderBottomWidth: 4, borderLeftWidth: 4, borderColor: '#FFF',
  },
  cornerBR: {
    bottom: -10, right: -10,
    borderBottomWidth: 4, borderRightWidth: 4, borderColor: '#FFF',
  },
});
