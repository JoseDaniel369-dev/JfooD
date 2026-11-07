import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Screen } from '@/components/Screen';
import { ScreenHeader } from '@/components/ScreenHeader';
import { colors, radius, spacing, typography } from '@/theme';

export default function ScannerScreen() {
  return (
    <Screen contentContainerStyle={styles.screenContent}>
      <ScreenHeader
        title="Escáner"
        subtitle="Reconocimiento asistido de comidas"
      />

      <View style={styles.illustration}>
        <View style={styles.iconContainer}>
          <Ionicons color={colors.primary} name="camera-outline" size={42} />
        </View>
        <Text style={styles.title}>Próximamente</Text>
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

      <Button title="Volver" variant="secondary" onPress={() => router.back()} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  screenContent: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  illustration: {
    alignItems: 'center',
    gap: spacing.sm,
  },
  iconContainer: {
    alignItems: 'center',
    backgroundColor: colors.primaryLight,
    borderRadius: radius.lg,
    height: 84,
    justifyContent: 'center',
    marginBottom: spacing.sm,
    width: 84,
  },
  title: {
    ...typography.title,
    color: colors.text,
    fontSize: 24,
  },
  description: {
    ...typography.body,
    color: colors.textMuted,
    lineHeight: 22,
    textAlign: 'center',
  },
  cardTitle: {
    ...typography.title,
    color: colors.text,
  },
  cardText: {
    ...typography.body,
    color: colors.textMuted,
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
    ...typography.caption,
    color: colors.primary,
    flex: 1,
    lineHeight: 18,
  },
});
