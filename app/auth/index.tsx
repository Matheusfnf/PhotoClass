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
  Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '@/context/AuthContext';
import { router } from 'expo-router';
import { AppColors, BorderRadius, FontSize, FontWeight, Shadow, Spacing } from '@/constants/design';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { SafeAreaView } from 'react-native-safe-area-context';
import { TERMS_URL, PRIVACY_URL } from '@/lib/legal';

type Mode = 'login' | 'signup';

// Gradiente da marca (mesmo da logo): azul → roxo → rosa.
const BRAND_GRADIENT = ['#4D30F4', '#6A23DE', '#DE27AC'] as const;
// Rosa da marca — legível tanto no card claro quanto no escuro.
const ACCENT_PINK = '#DE27AC';

export default function AuthScreen() {
  const scheme = useColorScheme() ?? 'dark';
  const colors = AppColors[scheme];
  const { signIn, signUp } = useAuth();

  const [mode, setMode] = useState<Mode>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [agreedTerms, setAgreedTerms] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isSignup = mode === 'signup';
  // Logo com o nome em indigo — legível no card claro e no escuro.
  const cardLogo = require('@/assets/images/logo-full-indigo.png');

  // Regras de senha (só valem no cadastro; no login o Supabase valida a conta existente)
  const hasMinLen = password.length >= 6;
  const hasUpper = /[A-Z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const passwordStrong = hasMinLen && hasUpper && hasNumber;
  const passwordsMatch = confirmPassword.length > 0 && password === confirmPassword;

  const handleSubmit = async () => {
    setError(null);
    if (!email.trim() || !password.trim()) {
      setError('Preencha email e senha.');
      return;
    }

    if (isSignup) {
      if (!name.trim()) {
        setError('Digite seu nome.');
        return;
      }
      if (!passwordStrong) {
        setError('A senha precisa de ao menos 6 caracteres, uma letra maiúscula e um número.');
        return;
      }
      if (!passwordsMatch) {
        setError('As senhas não coincidem.');
        return;
      }
      if (!agreedTerms) {
        setError('Você precisa aceitar os Termos de Uso e a Política de Privacidade.');
        return;
      }
    } else if (password.length < 6) {
      setError('A senha deve ter pelo menos 6 caracteres.');
      return;
    }

    setLoading(true);
    const result = isSignup
      ? await signUp(email.trim(), password, name)
      : await signIn(email.trim(), password);
    setLoading(false);

    if (result.error) {
      setError(result.error);
    } else if (isSignup) {
      Alert.alert(
        '🎉 Conta criada!',
        'Você já pode começar a usar o PhotoClass. Seus dados serão sincronizados automaticamente.',
        [{ text: 'Continuar', onPress: () => router.replace('/(tabs)' as any) }]
      );
    }
    // login bem-sucedido: o AuthContext atualiza o user e o _layout redireciona
  };

  const toggleMode = () => {
    setMode((m) => (m === 'login' ? 'signup' : 'login'));
    setError(null);
    setConfirmPassword('');
    setAgreedTerms(false);
  };

  return (
    <View style={s.container}>
      {/* Fundo em gradiente da marca (fixo nos dois temas) */}
      <LinearGradient
        colors={BRAND_GRADIENT}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      <SafeAreaView style={{ flex: 1 }}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <ScrollView
            contentContainerStyle={s.scroll}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {/* Card do formulário — centralizado, com a marca dentro */}
            <View style={[s.card, { backgroundColor: colors.surface }, Shadow.lg]}>
              <View style={s.cardHeader}>
                <Image source={cardLogo} style={s.logoFull} contentFit="contain" />
                <Text style={[s.cardGreeting, { color: colors.primary }]}>
                  {isSignup ? 'Crie sua conta' : 'Bem-vindo de volta!'}
                  {isSignup && <Text style={{ color: ACCENT_PINK }}> e comece agora!</Text>}
                </Text>
                <Text style={[s.cardSubtitle, { color: colors.textMuted }]}>
                  {isSignup
                    ? 'Sua jornada de estudos organizada começa aqui.'
                    : 'Continue de onde você parou.'}
                </Text>
              </View>

              {/* Nome (só no cadastro) */}
              {isSignup && (
                <View style={s.fieldGroup}>
                  <Text style={[s.label, { color: colors.textSecondary }]}>Nome completo</Text>
                  <View style={[s.inputWrapper, { backgroundColor: colors.background, borderColor: colors.border }]}>
                    <Ionicons name="person-outline" size={18} color={colors.primary} style={s.inputIcon} />
                    <TextInput
                      style={[s.input, { color: colors.text }]}
                      value={name}
                      onChangeText={setName}
                      placeholder="Digite seu nome completo"
                      placeholderTextColor={colors.textMuted}
                      autoCapitalize="words"
                      returnKeyType="next"
                      maxLength={80}
                    />
                  </View>
                </View>
              )}

              {/* Email */}
              <View style={s.fieldGroup}>
                <Text style={[s.label, { color: colors.textSecondary }]}>Email</Text>
                <View style={[s.inputWrapper, { backgroundColor: colors.background, borderColor: colors.border }]}>
                  <Ionicons name="mail-outline" size={18} color={colors.primary} style={s.inputIcon} />
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
                  <Ionicons name="lock-closed-outline" size={18} color={colors.primary} style={s.inputIcon} />
                  <TextInput
                    style={[s.input, { color: colors.text }]}
                    value={password}
                    onChangeText={setPassword}
                    placeholder={isSignup ? 'Crie uma senha' : '••••••••'}
                    placeholderTextColor={colors.textMuted}
                    secureTextEntry={!showPassword}
                    autoCapitalize="none"
                    returnKeyType={isSignup ? 'next' : 'done'}
                    onSubmitEditing={isSignup ? undefined : handleSubmit}
                  />
                  <Pressable onPress={() => setShowPassword((v) => !v)} hitSlop={8}>
                    <Ionicons
                      name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                      size={18}
                      color={colors.textMuted}
                    />
                  </Pressable>
                </View>
              </View>

              {/* Requisitos da senha (só no cadastro) */}
              {isSignup && password.length > 0 && (
                <View style={s.requirements}>
                  <Requirement met={hasMinLen} label="Ao menos 6 caracteres" colors={colors} />
                  <Requirement met={hasUpper} label="Uma letra maiúscula" colors={colors} />
                  <Requirement met={hasNumber} label="Um número" colors={colors} />
                </View>
              )}

              {/* Confirmar senha (só no cadastro) */}
              {isSignup && (
                <View style={s.fieldGroup}>
                  <Text style={[s.label, { color: colors.textSecondary }]}>Confirmar senha</Text>
                  <View style={[s.inputWrapper, { backgroundColor: colors.background, borderColor: colors.border }]}>
                    <Ionicons name="lock-closed-outline" size={18} color={colors.primary} style={s.inputIcon} />
                    <TextInput
                      style={[s.input, { color: colors.text }]}
                      value={confirmPassword}
                      onChangeText={setConfirmPassword}
                      placeholder="Confirme sua senha"
                      placeholderTextColor={colors.textMuted}
                      secureTextEntry={!showConfirm}
                      autoCapitalize="none"
                      returnKeyType="done"
                      onSubmitEditing={handleSubmit}
                    />
                    <Pressable onPress={() => setShowConfirm((v) => !v)} hitSlop={8}>
                      <Ionicons
                        name={showConfirm ? 'eye-off-outline' : 'eye-outline'}
                        size={18}
                        color={colors.textMuted}
                      />
                    </Pressable>
                  </View>
                  {confirmPassword.length > 0 && !passwordsMatch && (
                    <Text style={[s.mismatch, { color: colors.error }]}>As senhas não coincidem.</Text>
                  )}
                </View>
              )}

              {/* Aceite dos termos (só no cadastro) */}
              {isSignup && (
                <Pressable style={s.termsRow} onPress={() => setAgreedTerms((v) => !v)} hitSlop={6}>
                  <View
                    style={[
                      s.checkbox,
                      {
                        borderColor: agreedTerms ? colors.primary : colors.border,
                        backgroundColor: agreedTerms ? colors.primary : 'transparent',
                      },
                    ]}
                  >
                    {agreedTerms && <Ionicons name="checkmark" size={13} color="#FFF" />}
                  </View>
                  <Text style={[s.termsText, { color: colors.textSecondary }]}>
                    Eu concordo com os{' '}
                    <Text
                      style={{ color: colors.primary, fontWeight: FontWeight.semibold }}
                      onPress={() => Linking.openURL(TERMS_URL)}
                    >
                      Termos de Uso
                    </Text>
                    {' '}e a{' '}
                    <Text
                      style={{ color: colors.primary, fontWeight: FontWeight.semibold }}
                      onPress={() => Linking.openURL(PRIVACY_URL)}
                    >
                      Política de Privacidade
                    </Text>
                  </Text>
                </Pressable>
              )}

              {/* Erro */}
              {error && (
                <View style={[s.errorBox, { backgroundColor: colors.error + '18', borderColor: colors.error + '40' }]}>
                  <Ionicons name="alert-circle-outline" size={16} color={colors.error} />
                  <Text style={[s.errorText, { color: colors.error }]}>{error}</Text>
                </View>
              )}

              {/* Botão principal (gradiente) */}
              <Pressable onPress={handleSubmit} disabled={loading}>
                {({ pressed }) => (
                  <LinearGradient
                    colors={BRAND_GRADIENT}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={[s.primaryBtn, { opacity: pressed || loading ? 0.85 : 1 }]}
                  >
                    {loading ? (
                      <ActivityIndicator color="#FFF" size="small" />
                    ) : (
                      <Text style={s.primaryBtnText}>{isSignup ? 'Criar conta' : 'Entrar'}</Text>
                    )}
                  </LinearGradient>
                )}
              </Pressable>

              {/* Alternar modo */}
              <Pressable onPress={toggleMode} style={s.toggleBtn}>
                <Text style={[s.toggleText, { color: colors.textSecondary }]}>
                  {isSignup ? 'Já tem uma conta? ' : 'Não tem conta? '}
                  <Text style={{ color: colors.primary, fontWeight: FontWeight.semibold }}>
                    {isSignup ? 'Entrar' : 'Cadastre-se'}
                  </Text>
                </Text>
              </Pressable>
            </View>

            {/* Nota de privacidade */}
            <View style={s.footer}>
              <Ionicons name="cloud-outline" size={14} color="rgba(255,255,255,0.85)" />
              <Text style={s.footerText}>
                Seus dados ficam salvos na nuvem e sincronizados entre dispositivos.
              </Text>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

function Requirement({ met, label, colors }: { met: boolean; label: string; colors: any }) {
  return (
    <View style={s.reqRow}>
      <Ionicons
        name={met ? 'checkmark-circle' : 'ellipse-outline'}
        size={15}
        color={met ? colors.success : colors.textMuted}
      />
      <Text style={[s.reqText, { color: met ? colors.success : colors.textMuted }]}>{label}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  scroll: {
    flexGrow: 1,
    justifyContent: 'center', // centraliza o card verticalmente
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.xl,
    gap: Spacing.lg,
  },
  card: {
    borderRadius: BorderRadius['2xl'],
    padding: Spacing['2xl'],
    gap: Spacing.lg,
  },
  cardHeader: {
    alignItems: 'center',
    gap: 4,
    marginBottom: Spacing.xs,
  },
  logoFull: {
    width: 180,
    height: 51,
    marginBottom: Spacing.xs,
  },
  cardGreeting: {
    fontSize: FontSize.xl,
    fontWeight: FontWeight.heavy,
    textAlign: 'center',
    letterSpacing: -0.3,
  },
  cardSubtitle: {
    fontSize: FontSize.sm,
    textAlign: 'center',
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
  requirements: {
    gap: 4,
    marginTop: -Spacing.sm,
  },
  reqRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  reqText: {
    fontSize: FontSize.xs,
  },
  mismatch: {
    fontSize: FontSize.xs,
    marginTop: 2,
  },
  termsRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  termsText: {
    flex: 1,
    fontSize: FontSize.xs,
    lineHeight: 18,
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
    fontWeight: FontWeight.bold,
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
    paddingHorizontal: Spacing.lg,
  },
  footerText: {
    fontSize: FontSize.xs,
    textAlign: 'center',
    color: 'rgba(255,255,255,0.85)',
    flex: 1,
  },
});
