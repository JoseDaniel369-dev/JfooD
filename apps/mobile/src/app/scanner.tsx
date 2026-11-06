import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Card } from '@/components/Card';
import { colors, radius, spacing } from '@/theme';

export default function ScannerScreen() {
  return (
    <SafeAreaView edges={['bottom']} style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.iconContainer}>
          <Ionicons color={colors.primary} name="camera-outline" size={42} />
        </View>
        <View style={styles.heading}>
          <Text style={styles.title}>Reconocimiento asistido</Text>
          <Text style={styles.description}>
            La captura y el análisis con Gemini se conectarán en la fase del
            escáner. Ningún alimento se guardará sin tu revisión.
          </Text>
        </View>
        <Card>
          <Text style={styles.cardTitle}>Cómo funcionará</Text>
          <Text style={styles.cardText}>
            Gemini identificará alimentos y estimará gramos. Los valores
            nutricionales procederán de fuentes alimentarias y se calcularán con
            el motor propio de JfooD.
          </Text>
          <View style={styles.notice}>
            <Ionicons color={colors.primary} name="information-circle-outline" size={20} />
            <Text style={styles.noticeText}>
              Las cantidades detectadas en una fotografía siempre serán aproximadas.
            </Text>
          </View>
        </Card>
        <Pressable
          accessibilityRole="button"
          onPress={() => router.back()}
          style={({ pressed }) => [styles.button, pressed && styles.pressed]}
        >
          <Text style={styles.buttonText}>Volver</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: colors.background,
    flex: 1,
  },
  content: {
    gap: spacing.xl,
    padding: spacing.xl,
  },
  iconContainer: {
    alignItems: 'center',
    alignSelf: 'center',
    backgroundColor: colors.primaryLight,
    borderRadius: radius.lg,
    height: 84,
    justifyContent: 'center',
    marginTop: spacing.xl,
    width: 84,
  },
  heading: {
    gap: spacing.sm,
  },
  title: {
    color: colors.text,
    fontSize: 26,
    fontWeight: '700',
    letterSpacing: -0.6,
    textAlign: 'center',
  },
  description: {
    color: colors.textMuted,
    fontSize: 15,
    lineHeight: 23,
    textAlign: 'center',
  },
  cardTitle: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '700',
  },
  cardText: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 22,
  },
  notice: {
    alignItems: 'flex-start',
    backgroundColor: colors.primaryLight,
    borderRadius: radius.md,
    flexDirection: 'row',
    gap: spacing.sm,
    padding: spacing.md,
  },
  noticeText: {
    color: colors.primary,
    flex: 1,
    fontSize: 12,
    lineHeight: 18,
  },
  button: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    padding: spacing.lg,
  },
  buttonText: {
    color: colors.textOnPrimary,
    fontSize: 15,
    fontWeight: '700',
  },
  pressed: {
    opacity: 0.8,
  },
});
