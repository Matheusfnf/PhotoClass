import React, { useState, useRef, useEffect } from 'react';
import { View, Text, Pressable, StyleSheet, Alert, Linking } from 'react-native';
import { useAudioRecorder, useAudioRecorderState, AudioModule, RecordingPresets } from 'expo-audio';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { AppColors, BorderRadius, FontSize, FontWeight, Spacing } from '@/constants/design';
import { useColorScheme } from '@/hooks/use-color-scheme';

interface AudioRecorderProps {
  onRecordingComplete: (uri: string, durationSeconds: number) => void;
  onCancel: () => void;
}

export function AudioRecorder({ onRecordingComplete, onCancel }: AudioRecorderProps) {
  const scheme = useColorScheme() ?? 'dark';
  const colors = AppColors[scheme];

  const recorder = useAudioRecorder({
    ...RecordingPresets.HIGH_QUALITY,
    isMeteringEnabled: true,
  });
  const recorderState = useAudioRecorderState(recorder, 100);
  
  const [seconds, setSeconds] = useState(0);
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [meteringHistory, setMeteringHistory] = useState<number[]>(new Array(30).fill(-60));
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Update metering history
  useEffect(() => {
    if (isRecording && !isPaused && recorderState.metering !== undefined) {
      setMeteringHistory(prev => {
        const newHistory = [...prev.slice(1), recorderState.metering ?? -60];
        return newHistory;
      });
    }
  }, [recorderState.metering, isRecording, isPaused]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const startTimer = () => {
    timerRef.current = setInterval(() => {
      setSeconds((s) => s + 1);
    }, 1000);
  };

  const stopTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const handleStart = async () => {
    try {
      const status = await AudioModule.requestRecordingPermissionsAsync();
      if (!status.granted) {
        Alert.alert(
          'Permissão de Microfone',
          'O PhotoClass precisa de acesso ao microfone para gravar áudios. Deseja habilitar nas configurações?',
          [
            { text: 'Cancelar', style: 'cancel' },
            { text: 'Abrir Configurações', onPress: () => Linking.openSettings() }
          ]
        );
        return;
      }
      // iOS requires explicitly enabling recording mode
      await AudioModule.setAudioModeAsync({
        allowsRecording: true,
        playsInSilentMode: true,
      });
      
      // EXPO SDK 54/55 REQUIRES prepareToRecordAsync !!
      await recorder.prepareToRecordAsync();
      recorder.record();
      
      setIsRecording(true);
      setIsPaused(false);
      setSeconds(0);
      setMeteringHistory(new Array(30).fill(-60));
      startTimer();
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch (e) {
      console.error('Failed to start recording:', e);
    }
  };

  const handlePause = () => {
    if (isPaused) {
      recorder.record();
      startTimer();
      setIsPaused(false);
    } else {
      recorder.pause();
      stopTimer();
      setIsPaused(true);
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handleStop = async () => {
    try {
      stopTimer();
      await recorder.stop();
      setIsRecording(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      if (recorder.uri) {
        onRecordingComplete(recorder.uri, seconds);
      }
    } catch (e) {
      console.error('Failed to stop recording:', e);
    }
  };

  const handleCancel = async () => {
    try {
      stopTimer();
      if (isRecording) {
        await recorder.stop();
      }
      setIsRecording(false);
      setSeconds(0);
      onCancel();
    } catch (e) {
      console.error('Failed to cancel recording:', e);
    }
  };

  const formatTime = (s: number) => {
    const min = Math.floor(s / 60);
    const sec = s % 60;
    return `${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      {/* Timer */}
      <Text style={[styles.timer, { color: isRecording && !isPaused ? colors.error : colors.text }]}>
        {formatTime(Math.floor(recorderState.durationMillis / 1000))}
      </Text>

      {/* Live Waveform (WhatsApp style) */}
      {(isRecording || isPaused) && (
        <View style={styles.waveformContainer}>
          {meteringHistory.map((db, i) => {
            // Convert dB to height (approx -60 to 0 range)
            const normalized = Math.min(Math.max((db + 60) / 60, 0.1), 1);
            return (
              <View
                key={i}
                style={[
                  styles.waveformBar,
                  {
                    height: Math.max(4, normalized * 60),
                    backgroundColor: isPaused ? colors.borderLight : colors.error,
                  }
                ]}
              />
            );
          })}
        </View>
      )}

      {/* Recording indicator */}
      {isRecording && !isPaused && (
        <View style={styles.recordingIndicator}>
          <View style={[styles.recordingDot, { backgroundColor: colors.error }]} />
          <Text style={[styles.recordingLabel, { color: colors.error }]}>Gravando...</Text>
        </View>
      )}
      {isPaused && (
        <Text style={[styles.recordingLabel, { color: colors.warning }]}>Pausado</Text>
      )}

      {/* Controls */}
      <View style={styles.controls}>
        {!isRecording ? (
          <>
            <Pressable onPress={onCancel} style={styles.controlBtn}>
              <Ionicons name="close" size={28} color={colors.textMuted} />
            </Pressable>

            <Pressable
              onPress={handleStart}
              style={[styles.recordBtn, { backgroundColor: colors.error }]}
            >
              <Ionicons name="mic" size={32} color="#FFF" />
            </Pressable>

            <View style={styles.controlBtn} />
          </>
        ) : (
          <>
            <Pressable onPress={handleCancel} style={styles.controlBtn}>
              <Ionicons name="trash-outline" size={26} color={colors.error} />
            </Pressable>

            <Pressable
              onPress={handleStop}
              style={[styles.stopBtn, { backgroundColor: colors.error }]}
            >
              <Ionicons name="stop" size={28} color="#FFF" />
            </Pressable>

            <Pressable onPress={handlePause} style={styles.controlBtn}>
              <Ionicons
                name={isPaused ? 'play' : 'pause'}
                size={26}
                color={colors.primary}
              />
            </Pressable>
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    padding: Spacing['2xl'],
    alignItems: 'center',
    gap: Spacing.lg,
    margin: Spacing.xl,
  },
  timer: {
    fontSize: 48,
    fontWeight: FontWeight.bold,
    fontVariant: ['tabular-nums'],
  },
  recordingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  recordingDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  recordingLabel: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing['3xl'],
    marginTop: Spacing.sm,
  },
  waveformContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 80,
    width: '100%',
    gap: 3,
  },
  waveformBar: {
    width: 3,
    borderRadius: 1.5,
  },
  controlBtn: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  recordBtn: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: '#FF7675',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  stopBtn: {
    width: 64,
    height: 64,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
  },
});
