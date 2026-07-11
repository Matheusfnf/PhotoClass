import React, { useEffect, useState } from 'react';
import { Dimensions } from 'react-native';
import { Image, ImageProps } from 'expo-image';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  useAnimatedReaction,
  withSpring,
  withTiming,
  runOnJS,
} from 'react-native-reanimated';

const AnimatedImage = Animated.createAnimatedComponent(Image);
const { width: W, height: H } = Dimensions.get('window');

// iOS Photos-like spring physics
const SPRING = {
  damping: 24,
  stiffness: 280,
  mass: 0.6,
  overshootClamping: false,
  restDisplacementThreshold: 0.01,
  restSpeedThreshold: 0.01,
};

const clamp = (val: number, min: number, max: number) => {
  'worklet';
  return Math.min(Math.max(val, min), max);
};

interface ZoomableImageProps extends ImageProps {
  /** When true, pinch/pan/double-tap gestures are active */
  zoomEnabled?: boolean;
  /** Single-tap callback — use to toggle fullscreen */
  onPress?: () => void;
  /**
   * Avisa quando a foto entra/sai do zoom (scale > 1). O pai usa isso pra
   * DESLIGAR o swipe do PagerView enquanto ampliada — senão o pager rouba o
   * gesto de arrastar e o zoom parece "travado".
   */
  onZoomChange?: (zoomed: boolean) => void;
  /** Incremente este número pra resetar o zoom de fora (botão "sair do zoom"). */
  resetZoomTrigger?: number;
}

export function ZoomableImage({ zoomEnabled = false, onPress, onZoomChange, resetZoomTrigger = 0, ...props }: ZoomableImageProps) {
  // Estado JS espelhando "está ampliada?" — habilita o pan só quando faz
  // sentido (ampliada), deixando o gesto horizontal livre pro pager quando não.
  const [isZoomed, setIsZoomed] = useState(false);

  // Container real (onLayout) e proporção natural da imagem (onLoad): é disso
  // que saem os limites de pan. Usar o tamanho da JANELA deixava arrastar a
  // foto pra fora da tela, porque com contentFit="contain" a área renderizada
  // da imagem é menor que a janela.
  const containerW = useSharedValue(W);
  const containerH = useSharedValue(H);
  const aspect = useSharedValue(0); // largura/altura natural da imagem

  /** Área efetivamente ocupada pela imagem dentro do container (contain). */
  function contentSize() {
    'worklet';
    const cw = containerW.value;
    const ch = containerH.value;
    if (aspect.value <= 0) return { w: cw, h: ch };
    let w = cw;
    let h = cw / aspect.value;
    if (h > ch) {
      h = ch;
      w = ch * aspect.value;
    }
    return { w, h };
  }

  /** Até onde o pan pode ir num dado scale sem a borda da foto passar do container. */
  function maxOffsets(s: number) {
    'worklet';
    const { w, h } = contentSize();
    return {
      x: Math.max(0, (w * s - containerW.value) / 2),
      y: Math.max(0, (h * s - containerH.value) / 2),
    };
  }
  // Current transform state
  const scale = useSharedValue(1);
  const offsetX = useSharedValue(0);
  const offsetY = useSharedValue(0);

  // Saved state at gesture start
  const savedScale = useSharedValue(1);
  const savedOffsetX = useSharedValue(0);
  const savedOffsetY = useSharedValue(0);

  // Focal point captured at pinch start
  const pinchFocalX = useSharedValue(0);
  const pinchFocalY = useSharedValue(0);

  function resetAll() {
    'worklet';
    scale.value = withSpring(1, SPRING);
    offsetX.value = withSpring(0, SPRING);
    offsetY.value = withSpring(0, SPRING);
    savedScale.value = 1;
    savedOffsetX.value = 0;
    savedOffsetY.value = 0;
  }

  const notifyZoom = (zoomed: boolean) => {
    setIsZoomed(zoomed);
    onZoomChange?.(zoomed);
  };

  // Observa o scale na thread de UI e avisa o JS quando cruza o limiar do zoom.
  useAnimatedReaction(
    () => scale.value > 1.01,
    (zoomed, prev) => {
      if (zoomed !== prev) runOnJS(notifyZoom)(zoomed);
    }
  );

  // Reset externo (botão "sair do zoom" do pai)
  useEffect(() => {
    if (resetZoomTrigger > 0) {
      scale.value = withTiming(1, { duration: 200 });
      offsetX.value = withTiming(0, { duration: 200 });
      offsetY.value = withTiming(0, { duration: 200 });
      savedScale.value = 1;
      savedOffsetX.value = 0;
      savedOffsetY.value = 0;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetZoomTrigger]);

  // Reset zoom when exiting fullscreen
  useEffect(() => {
    if (!zoomEnabled) {
      scale.value = withTiming(1, { duration: 200 });
      offsetX.value = withTiming(0, { duration: 200 });
      offsetY.value = withTiming(0, { duration: 200 });
      savedScale.value = 1;
      savedOffsetX.value = 0;
      savedOffsetY.value = 0;
    }
  }, [zoomEnabled]);

  // ── Pinch to zoom (with correct focal point) ───────────────────────────────
  const pinch = Gesture.Pinch()
    .enabled(zoomEnabled)
    .onStart((e) => {
      // Capture state at gesture start
      savedScale.value = scale.value;
      savedOffsetX.value = offsetX.value;
      savedOffsetY.value = offsetY.value;
      // Focal point is in component-local coordinates; center it
      pinchFocalX.value = e.focalX - containerW.value / 2;
      pinchFocalY.value = e.focalY - containerH.value / 2;
    })
    .onUpdate((e) => {
      const newScale = clamp(savedScale.value * e.scale, 0.8, 10);
      scale.value = newScale;

      // Focal-point zoom: the pixel under the pinch center stays fixed.
      // Math: newOffset = focal * (1 - ratio) + savedOffset * ratio
      // where ratio = newScale / savedScale
      const ratio = newScale / savedScale.value;
      const fx = pinchFocalX.value;
      const fy = pinchFocalY.value;

      const rawX = fx * (1 - ratio) + savedOffsetX.value * ratio;
      const rawY = fy * (1 - ratio) + savedOffsetY.value * ratio;

      // Clamp pan so image edges don't go past the rendered photo bounds
      const m = maxOffsets(newScale);
      offsetX.value = clamp(rawX, -m.x, m.x);
      offsetY.value = clamp(rawY, -m.y, m.y);
    })
    .onEnd(() => {
      if (scale.value < 1) {
        resetAll();
      } else {
        // Snap offset into bounds after releasing
        const m = maxOffsets(scale.value);
        const maxX = m.x;
        const maxY = m.y;
        if (Math.abs(offsetX.value) > maxX) {
          offsetX.value = withSpring(offsetX.value > 0 ? maxX : -maxX, SPRING);
        }
        if (Math.abs(offsetY.value) > maxY) {
          offsetY.value = withSpring(offsetY.value > 0 ? maxY : -maxY, SPRING);
        }
        savedScale.value = scale.value;
        savedOffsetX.value = offsetX.value;
        savedOffsetY.value = offsetY.value;
      }
    });

  // ── Pan (only while zoomed in) ─────────────────────────────────────────────
  // Habilitado SÓ quando ampliada: com scale 1 o arrasto horizontal pertence ao
  // PagerView (trocar de foto). Sem essa condição os dois brigam pelo gesto.
  const pan = Gesture.Pan()
    .enabled(zoomEnabled && isZoomed)
    .minPointers(1)
    .maxPointers(2)
    .onStart(() => {
      savedOffsetX.value = offsetX.value;
      savedOffsetY.value = offsetY.value;
    })
    .onUpdate((e) => {
      if (scale.value <= 1) return;
      const m = maxOffsets(scale.value);
      offsetX.value = clamp(savedOffsetX.value + e.translationX, -m.x, m.x);
      offsetY.value = clamp(savedOffsetY.value + e.translationY, -m.y, m.y);
    })
    .onEnd((e) => {
      if (scale.value <= 1) {
        resetAll();
        return;
      }
      // Momentum-like deceleration: add a fraction of velocity
      const m = maxOffsets(scale.value);
      const projX = clamp(offsetX.value + e.velocityX * 0.1, -m.x, m.x);
      const projY = clamp(offsetY.value + e.velocityY * 0.1, -m.y, m.y);
      offsetX.value = withSpring(projX, SPRING);
      offsetY.value = withSpring(projY, SPRING);
      savedOffsetX.value = projX;
      savedOffsetY.value = projY;
    });

  // ── Double-tap to zoom in/out ──────────────────────────────────────────────
  const doubleTap = Gesture.Tap()
    .enabled(zoomEnabled)
    .numberOfTaps(2)
    .maxDuration(300)
    .onEnd((e) => {
      if (scale.value > 1) {
        resetAll();
      } else {
        const targetScale = 3.0;
        // Zoom toward the tapped point
        const fx = e.x - containerW.value / 2;
        const fy = e.y - containerH.value / 2;
        const ratio = targetScale / 1;
        const m = maxOffsets(targetScale);
        const maxX = m.x;
        const maxY = m.y;
        const rawX = fx * (1 - ratio);
        const rawY = fy * (1 - ratio);
        scale.value = withSpring(targetScale, SPRING);
        offsetX.value = withSpring(clamp(rawX, -maxX, maxX), SPRING);
        offsetY.value = withSpring(clamp(rawY, -maxY, maxY), SPRING);
        savedScale.value = targetScale;
        savedOffsetX.value = clamp(rawX, -maxX, maxX);
        savedOffsetY.value = clamp(rawY, -maxY, maxY);
      }
    });

  // ── Single tap to toggle fullscreen ────────────────────────────────────────
  const singleTap = Gesture.Tap()
    .numberOfTaps(1)
    .maxDuration(250)
    .runOnJS(true)
    .onEnd(() => {
      onPress?.();
    });

  // Double-tap takes priority over single-tap.
  // Pinch and pan run simultaneously with each other.
  const tapGesture = Gesture.Exclusive(doubleTap, singleTap);
  const composed = Gesture.Simultaneous(tapGesture, pinch, pan);

  const animStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: offsetX.value },
      { translateY: offsetY.value },
      { scale: scale.value },
    ],
  }));

  return (
    <GestureDetector gesture={composed}>
      <AnimatedImage
        {...props}
        onLayout={(e) => {
          containerW.value = e.nativeEvent.layout.width;
          containerH.value = e.nativeEvent.layout.height;
        }}
        onLoad={(e) => {
          if (e.source?.width && e.source?.height) {
            aspect.value = e.source.width / e.source.height;
          }
          props.onLoad?.(e);
        }}
        style={[props.style, animStyle]}
      />
    </GestureDetector>
  );
}
