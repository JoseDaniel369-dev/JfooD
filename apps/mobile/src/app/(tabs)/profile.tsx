import { StyleSheet, Text, View } from 'react-native';

import { Screen } from '@/components/Screen';
import { ScreenHeader } from '@/components/ScreenHeader';
import { ErrorState, LoadingState } from '@/components/AsyncState';
import { ProfileForm } from '@/features/profile/components/ProfileForm';
import { useProfile } from '@/features/profile/hooks/useProfile';
import { colors, radius, spacing } from '@/theme';

export default function ProfileScreen() {
  const { error, load, loading, profile, saving, update } = useProfile();

  if (loading) {
    return (
      <Screen>
        <LoadingState />
      </Screen>
    );
  }

  return (
    <Screen>
      <ScreenHeader
        title="Perfil y objetivos"
        subtitle="Calculados a partir de tus datos, sin crear una cuenta"
      />

      {error && !profile ? (
        <ErrorState message={error} onRetry={() => void load()} />
      ) : null}

      {error && profile ? (
        <View style={styles.errorBanner}>
          <Text style={styles.errorBannerText}>{error}</Text>
        </View>
      ) : null}

      <ProfileForm
        initial={profile}
        onSubmit={(data) => void update(data)}
        saving={saving}
      />

      {profile ? (
        <View style={styles.notice}>
          <Text style={styles.noticeText}>
            Tus objetivos se recalcularán con la ecuación de Mifflin-St Jeor
            usando tu peso, altura, edad, sexo y nivel de actividad.
          </Text>
        </View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  errorBanner: {
    backgroundColor: 'rgba(164, 71, 61, 0.12)',
    borderRadius: radius.md,
    padding: spacing.md,
  },
  errorBannerText: {
    color: colors.danger,
    fontSize: 13,
    lineHeight: 20,
    textAlign: 'center',
  },
  notice: {
    backgroundColor: colors.primaryLight,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  noticeText: {
    color: colors.primary,
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
  },
});
