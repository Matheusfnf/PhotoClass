import React, { useEffect, useRef } from 'react';
import { View, Text, Pressable, StyleSheet, PanResponder } from 'react-native';
import { useAudioPlayer, useAudioPlayerStatus, AudioModule } from 'expo-audio';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { AppColors, BorderRadius, FontSize, Spacing } from '@/constants/design';
import { useColorScheme } from '@/hooks/use-color-scheme';

interface AudioPlayerProps {
  uri: string;
  duration?: number | null;
  onScrubbingChange?: (isScrubbing: boolean) => void;
}

export function AudioPlayer({ uri, duration, onScrubbingChange }: AudioPlayerProps) {
  const waveformWidth = useRef(0);
  useEffect(() => {
    // Força o iOS a sair do estado "Mic Ativado", que redireciona 
    // frequentemente o playback para o alto-falante mudo inferior do sistema.
    AudioModule.setAudioModeAsync({
      allowsRecording: false,
      playsInSilentMode: true,
    }).catch(e => console.warn('Failed to set playback mode:', e));
  }, []);
  const scheme = useColorScheme() ?? 'dark';
  const colors = AppColors[scheme];

  const player = useAudioPlayer(uri);
  const status = useAudioPlayerStatus(player);
  const [smoothTime, setSmoothTime] = React.useState(0);
  const [isScrubbingLocal, setIsScrubbingLocal] = React.useState(false);

  const isPlaying = status.playing;
  
  // Sync smoothTime with status when it changes (seeks, etc)
  React.useEffect(() => {
    if (!isScrubbingLocal) {
      setSmoothTime(status.currentTime ?? 0);
    }
  }, [status.currentTime, isScrubbingLocal]);

  // Interpolation loop for high-frequency updates when playing
  React.useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (isPlaying && !isScrubbingLocal) {
      interval = setInterval(() => {
        setSmoothTime(player.currentTime);
      }, 50); // 20fps for smooth visual progress
    }
    return () => clearInterval(interval);
  }, [isPlaying, player, isScrubbingLocal]);

  const currentTime = Math.floor(smoothTime);
  const totalDuration = duration ?? Math.floor(status.duration ?? 0);
  const progress = totalDuration > 0 ? smoothTime / totalDuration : 0;

  const handlePlayPause = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (isPlaying) {
      player.pause();
    } else {
      player.play();
    }
  };

  const handleRewind = () => {
    const newTime = Math.max(0, (status.currentTime ?? 0) - 10000);
    player.seekTo(newTime);
  };

  const handleForward = () => {
    const newTime = Math.min(totalDuration * 1000, (status.currentTime ?? 0) + 10000);
    player.seekTo(newTime);
  };

  const formatTime = (s: number) => {
    const min = Math.floor(s / 60);
    const sec = s % 60;
    return `${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  };

  const durationRef = useRef(totalDuration);
  durationRef.current = totalDuration;
  const onScrubbingRef = useRef(onScrubbingChange);
  onScrubbingRef.current = onScrubbingChange;
  const playerRef = useRef(player);
  playerRef.current = player;

  const scrubTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (evt) => {
        if (scrubTimeoutRef.current) clearTimeout(scrubTimeoutRef.current);
        onScrubbingRef.current?.(true);
        setIsScrubbingLocal(true);
        if (waveformWidth.current > 0) {
          const seekPos = Math.max(0, Math.min(1, evt.nativeEvent.locationX / waveformWidth.current)) * durationRef.current;
          setSmoothTime(seekPos);
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }
      },
      onPanResponderMove: (evt) => {
        if (waveformWidth.current > 0) {
          const seekPos = Math.max(0, Math.min(1, evt.nativeEvent.locationX / waveformWidth.current)) * durationRef.current;
          setSmoothTime(seekPos);
        }
      },
      onPanResponderRelease: (evt) => {
        onScrubbingRef.current?.(false);
        if (waveformWidth.current > 0) {
          const seekPos = Math.max(0, Math.min(1, evt.nativeEvent.locationX / waveformWidth.current)) * durationRef.current;
          setSmoothTime(seekPos);
          playerRef.current.seekTo(seekPos);
        }
        scrubTimeoutRef.current = setTimeout(() => {
          setIsScrubbingLocal(false);
        }, 300);
      },
      onPanResponderTerminate: () => {
        onScrubbingRef.current?.(false);
        scrubTimeoutRef.current = setTimeout(() => {
          setIsScrubbingLocal(false);
        }, 300);
      }
    })
  ).current;

  return (
    <View style={[styles.container, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      {/* Waveform Progress bar */}
      <View 
        style={styles.waveformContainer}
        onLayout={(e) => {
          waveformWidth.current = e.nativeEvent.layout.width;
        }}
        {...panResponder.panHandlers}
      >
        {Array.from({ length: 45 }).map((_, i) => {
          const pseudoRandom = Math.sin(i * 0.5) * 0.3 + Math.cos(i * 1.2) * 0.2 + 0.5; 
          const val = 0.2 + pseudoRandom * 0.8;
          const isActive = (i / 45) <= progress;
          return (
            <View
              key={i}
              pointerEvents="none"
              style={[
                styles.waveformBar,
                {
                  height: Math.max(4, val * 36),
                  backgroundColor: isActive ? colors.primary : colors.borderLight,
                },
              ]}
            />
          );
        })}
        {/* Scrubber Thumb */}
        <View 
          pointerEvents="none"
          style={[
            styles.scrubberThumb, 
            { 
              backgroundColor: colors.primary,
              left: `${Math.min(100, Math.max(0, progress * 100))}%`
            }
          ]} 
        />
      </View>

      {/* Time labels */}
      <View style={styles.timeRow}>
        <Text style={[styles.timeText, { color: colors.textMuted }]}>
          {formatTime(currentTime)}
        </Text>
        <Text style={[styles.timeText, { color: colors.textMuted }]}>
          {formatTime(totalDuration)}
        </Text>
      </View>

      {/* Controls */}
      <View style={styles.controls}>
        <Pressable onPress={handleRewind} style={styles.controlBtn}>
          <Ionicons name="play-back" size={24} color={colors.textSecondary} />
        </Pressable>

        <Pressable
          onPress={handlePlayPause}
          style={[styles.playBtn, { backgroundColor: colors.primary }]}
        >
          <Ionicons
            name={isPlaying ? 'pause' : 'play'}
            size={28}
            color="#FFF"
          />
        </Pressable>

        <Pressable onPress={handleForward} style={styles.controlBtn}>
          <Ionicons name="play-forward" size={24} color={colors.textSecondary} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    padding: Spacing.xl,
    gap: Spacing.md,
  },
  waveformContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 40,
    width: '100%',
    paddingHorizontal: 2,
  },
  waveformBar: {
    width: 3,
    borderRadius: 1.5,
  },
  scrubberThumb: {
    position: 'absolute',
    top: -4,
    bottom: -4,
    width: 6,
    borderRadius: 3,
    transform: [{ translateX: -3 }],
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  timeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  timeText: {
    fontSize: FontSize.xs,
    fontVariant: ['tabular-nums'],
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing['3xl'],
    marginTop: Spacing.sm,
  },
  controlBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playBtn: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
  },
});
