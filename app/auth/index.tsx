import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/context/AuthContext';
import { router } from 'expo-router';
import { AppColors, BorderRadius, FontSize, FontWeight, Spacing } from '@/constants/design';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { SafeAreaView } from 'react-native-safe-area-context';

type Mode = 'login' | 'signup';

export default function AuthScreen() {
  const scheme = useColorScheme() ?? 'dark';
  const colors = AppColors[scheme];
  const { signIn, signUp } = useAuth();

  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    setError(null);
    if (!email.trim() || !password.trim()) {
      setError('Preencha email e senha.');
      return;
    }
    if (password.length < 6) {
      setError('A senha deve ter pelo menos 6 caracteres.');
      return;
    }

    setLoading(true);
    const result = mode === 'login'
      ? await signIn(email.trim(), password)
      : await signUp(email.trim(), password);
    setLoading(false);

    if (result.error) {
      setError(result.error);
    } else if (mode === 'signup') {
      Alert.alert(
        '🎉 Conta criada!',
        'Você já pode começar a usar o PhotoClass. Seus dados serão sincronizados automaticamente.',
        [{ text: 'Continuar', onPress: () => router.replace('/(tabs)' as any) }]
      );
    }
    // login bem-sucedido: o AuthContext vai atualizar o user e o _layout vai redirecionar
  };

  const toggleMode = () => {
    setMode(m => m === 'login' ? 'signup' : 'login');
    setError(null);
  };

  return (
    <SafeAreaView style={[s.container, { backgroundColor: colors.background }]}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={s.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Logo */}
          <View style={s.logoArea}>
            <View style={[s.logoCircle, { backgroundColor: colors.primary }]}>
              <Ionicons name="school" size={42} color="#FFF" />
            </View>
            <Text style={[s.appName, { color: colors.text }]}>PhotoClass</Text>
            <Text style={[s.appTagline, { color: colors.textSecondary }]}>
              Organize suas aulas, em qualquer lugar.
            </Text>
          </View>

          {/* Card */}
          <View style={[s.card, { backgroundColor: colors.surface, borderColor: colors.borderLight }]}>
            <Text style={[s.cardTitle, { color: colors.text }]}>
              {mode === 'login' ? 'Entrar na conta' : 'Criar conta'}
            </Text>

            {/* Email */}
            <View style={s.fieldGroup}>
              <Text style={[s.label, { color: colors.textSecondary }]}>Email</Text>
              <View style={[s.inputWrapper, { backgroundColor: colors.background, borderColor: colors.border }]}>
                <Ionicons name="mail-outline" size={18} color={colors.textMuted} style={s.inputIcon} />
                <TextInput
                  style={[s.input, { color: colors.text }]}
                  value={email}
                  onChangeText={setEmail}
                  placeholder="seu@email.com"
                  placeholderTextColor={colors.textMuted}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  returnKeyType="next"
                />
              </View>
            </View>

            {/* Senha */}
            <View style={s.fieldGroup}>
              <Text style={[s.label, { color: colors.textSecondary }]}>Senha</Text>
              <View style={[s.inputWrapper, { backgroundColor: colors.background, borderColor: colors.border }]}>
                <Ionicons name="lock-closed-outline" size={18} color={colors.textMuted} style={s.inputIcon} />
                <TextInput
                  style={[s.input, { color: colors.text }]}
                  value={password}
                  onChangeText={setPassword}
                  placeholder="••••••••"
                  placeholderTextColor={colors.textMuted}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  returnKeyType="done"
                  onSubmitEditing={handleSubmit}
                />
                <Pressable onPress={() => setShowPassword(v => !v)} hitSlop={8}>
                  <Ionicons
                    name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                    size={18}
                    color={colors.textMuted}
                  />
                </Pressable>
              </View>
            </View>

            {/* Erro */}
            {error && (
              <View style={[s.errorBox, { backgroundColor: colors.error + '18', borderColor: colors.error + '40' }]}>
                <Ionicons name="alert-circle-outline" size={16} color={colors.error} />
                <Text style={[s.errorText, { color: colors.error }]}>{error}</Text>
              </View>
            )}

            {/* Botão principal */}
            <Pressable
              onPress={handleSubmit}
              disabled={loading}
              style={({ pressed }) => [
                s.primaryBtn,
                { backgroundColor: colors.primary, opacity: pressed || loading ? 0.8 : 1 },
              ]}
            >
              {loading ? (
                <ActivityIndicator color="#FFF" size="small" />
              ) : (
                <Text style={s.primaryBtnText}>
                  {mode === 'login' ? 'Entrar' : 'Criar conta'}
                </Text>
              )}
            </Pressable>

            {/* Alternar modo */}
            <Pressable onPress={toggleMode} style={s.toggleBtn}>
              <Text style={[s.toggleText, { color: colors.textSecondary }]}>
                {mode === 'login' ? 'Não tem conta? ' : 'Já tem conta? '}
                <Text style={{ color: colors.primary, fontWeight: FontWeight.semibold }}>
                  {mode === 'login' ? 'Cadastre-se' : 'Entrar'}
                </Text>
              </Text>
            </Pressable>
          </View>

          {/* Nota de privacidade */}
          <View style={s.footer}>
            <Ionicons name="cloud-outline" size={14} color={colors.textMuted} />
            <Text style={[s.footerText, { color: colors.textMuted }]}>
              Seus dados ficam salvos na nuvem e sincronizados entre dispositivos.
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing['4xl'],
    paddingBottom: Spacing['3xl'],
    gap: Spacing['2xl'],
  },
  logoArea: {
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.xl,
  },
  logoCircle: {
    width: 80,
    height: 80,
    borderRadius: BorderRadius.xl,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.sm,
  },
  appName: {
    fontSize: FontSize['3xl'],
    fontWeight: FontWeight.heavy,
    letterSpacing: -0.5,
  },
  appTagline: {
    fontSize: FontSize.md,
    textAlign: 'center',
  },
  card: {
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    padding: Spacing['2xl'],
    gap: Spacing.lg,
  },
  cardTitle: {
    fontSize: FontSize.xl,
    fontWeight: FontWeight.bold,
    marginBottom: Spacing.xs,
  },
  fieldGroup: {
    gap: Spacing.xs,
  },
  label: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.medium,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    height: 48,
  },
  inputIcon: {
    marginRight: Spacing.sm,
  },
  input: {
    flex: 1,
    fontSize: FontSize.md,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
  },
  errorText: {
    fontSize: FontSize.sm,
    flex: 1,
  },
  primaryBtn: {
    height: 52,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.xs,
  },
  primaryBtnText: {
    color: '#FFF',
    fontSize: FontSize.md,
    fontWeight: FontWeight.semibold,
  },
  toggleBtn: {
    alignItems: 'center',
    paddingVertical: Spacing.sm,
  },
  toggleText: {
    fontSize: FontSize.sm,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    paddingBottom: Spacing.lg,
  },
  footerText: {
    fontSize: FontSize.xs,
    textAlign: 'center',
    flex: 1,
  },
});
