import React, { useEffect } from 'react';
import { Dimensions } from 'react-native';
import { Image, ImageProps } from 'expo-image';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
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
}

export function ZoomableImage({ zoomEnabled = false, onPress, ...props }: ZoomableImageProps) {
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
      pinchFocalX.value = e.focalX - W / 2;
      pinchFocalY.value = e.focalY - H / 2;
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

      // Clamp pan so image edges don't go past screen
      const maxX = Math.max(0, (W * newScale - W) / 2);
      const maxY = Math.max(0, (H * newScale - H) / 2);
      offsetX.value = clamp(rawX, -maxX, maxX);
      offsetY.value = clamp(rawY, -maxY, maxY);
    })
    .onEnd(() => {
      if (scale.value < 1) {
        resetAll();
      } else {
        // Snap offset into bounds after releasing
        const maxX = Math.max(0, (W * scale.value - W) / 2);
        const maxY = Math.max(0, (H * scale.value - H) / 2);
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
  const pan = Gesture.Pan()
    .enabled(zoomEnabled)
    .minPointers(1)
    .maxPointers(2)
    .onStart(() => {
      savedOffsetX.value = offsetX.value;
      savedOffsetY.value = offsetY.value;
    })
    .onUpdate((e) => {
      if (scale.value <= 1) return;
      const maxX = Math.max(0, (W * scale.value - W) / 2);
      const maxY = Math.max(0, (H * scale.value - H) / 2);
      offsetX.value = clamp(savedOffsetX.value + e.translationX, -maxX, maxX);
      offsetY.value = clamp(savedOffsetY.value + e.translationY, -maxY, maxY);
    })
    .onEnd((e) => {
      if (scale.value <= 1) {
        resetAll();
        return;
      }
      // Momentum-like deceleration: add a fraction of velocity
      const maxX = Math.max(0, (W * scale.value - W) / 2);
      const maxY = Math.max(0, (H * scale.value - H) / 2);
      const projX = clamp(offsetX.value + e.velocityX * 0.1, -maxX, maxX);
      const projY = clamp(offsetY.value + e.velocityY * 0.1, -maxY, maxY);
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
        const fx = e.x - W / 2;
        const fy = e.y - H / 2;
        const ratio = targetScale / 1;
        const maxX = Math.max(0, (W * targetScale - W) / 2);
        const maxY = Math.max(0, (H * targetScale - H) / 2);
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
        style={[props.style, animStyle]}
      />
    </GestureDetector>
  );
}
