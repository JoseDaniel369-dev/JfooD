import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { useSQLiteContext } from 'expo-sqlite';
import { useMemo, useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';


import { AnimatedPressable } from '@/components/AnimatedPressable';
import { BottomSheet } from '@/components/BottomSheet';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { ErrorState, LoadingState } from '@/components/AsyncState';
import { Screen } from '@/components/Screen';
import { Segmented, type SegmentedOption } from '@/components/Segmented';
import { SectionHeader } from '@/components/SectionHeader';
import { TextField } from '@/components/TextField';
import { useToast } from '@/components/Toast';
import { getCatalogProblem } from '@/data/catalog/catalogDatabase';
import { CATALOG_COUNTS } from '@/data/catalog/catalogVersion';
import { BackupCard } from '@/features/backup/BackupCard';
import { toLocalDate } from '@/features/diary/utils/date';
import { hapticSuccess } from '@/features/haptics/haptics';
import { avatarInitial } from '@/features/home/greeting';
import { staggerIn } from '@/features/motion/springs';
import { GoalsSummary } from '@/features/profile/components/GoalsSummary';
import { ProfileForm, type ProfileSubmitMeta } from '@/features/profile/components/ProfileForm';
import { useDisplayName } from '@/features/profile/hooks/useDisplayName';
import { useProfile } from '@/features/profile/hooks/useProfile';
import { scheduleReminders } from '@/features/reminders/notifications';
import { RemindersCard } from '@/features/reminders/RemindersCard';
import { useDiaryStats } from '@/features/stats/hooks/useDiaryStats';
import { computeStreak } from '@/features/stats/utils/streak';
import { useWaterGoal } from '@/features/water/hooks/useWaterGoal';
import { parseWaterGoal } from '@/features/water/utils/goal';
import {
  fonts,
  onHeroTrack,
  radius,
  spacing,
  typography,
  useTheme,
  type ThemeColors,
  type ThemePreference,
  fontSizes,
} from '@/theme';

const THEME_OPTIONS: SegmentedOption<ThemePreference>[] = [
  { value: 'system', label: 'Sistema' },
  { value: 'light', label: 'Claro' },
  { value: 'dark', label: 'Oscuro' },
];

export default function ProfileScreen() {
  const { colors, preference, setPreference } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const database = useSQLiteContext();
  const { showToast } = useToast();
  const { error, goals, load, loading, profile, saving, update } = useProfile();
  const { name, save: saveName, reload: reloadName } = useDisplayName();
  const { stats } = useDiaryStats();

  const { goalMl: storedWaterGoal, setGoalMl, reload: reloadWaterGoal } = useWaterGoal();
  /** Bumped after a restore so the reminders card reads the restored settings. */
  const [restoreCount, setRestoreCount] = useState(0);
  const [waterGoalDraft, setWaterGoalDraft] = useState<string | null>(null);
  const [editingProfile, setEditingProfile] = useState(false);
  const [nameDraft, setNameDraft] = useState<string | null>(null);
  const [nameError, setNameError] = useState<string | null>(null);

  const streak = stats ? computeStreak(stats.loggedDates, toLocalDate(new Date())).current : 0;
  const loggedDays = stats?.loggedDates.length ?? 0;
  const initial = avatarInitial(name);

  const handleSave = async (data: Parameters<typeof update>[0], meta: ProfileSubmitMeta) => {
    const result = await update(data, { loadedWeightKg: meta.loadedWeightKg });
    if (result) {
      hapticSuccess();
      setEditingProfile(false);
      showToast('Perfil y objetivos guardados.');
    }
  };

  const handleThemeChange = async (value: ThemePreference) => {
    try {
      await setPreference(value);
    } catch {
      showToast('No se ha podido guardar el tema.', 'error');
    }
  };

  const handleWaterGoalChange = async () => {
    const parsed = parseWaterGoal(waterGoalDraft ?? String(storedWaterGoal));
    if (parsed === null) {
      showToast('Introduce un objetivo de agua válido.', 'error');
      return;
    }

    const saved = await setGoalMl(parsed);
    if (saved) {
      setWaterGoalDraft(null);
      hapticSuccess();
      showToast('Objetivo de agua guardado.');
    } else {
      showToast('No se ha podido guardar el objetivo.', 'error');
    }
  };

  const handleNameSave = async () => {
    const saved = await saveName(nameDraft ?? '');
    if (saved) {
      setNameDraft(null);
      hapticSuccess();
      showToast('Nombre guardado.');
    } else {
      // Inline: a toast would hide under the sheet.
      setNameError('No se ha podido guardar el nombre. Inténtalo de nuevo.');
    }
  };

  if (loading) {
    return (
      <Screen>
        <LoadingState />
      </Screen>
    );
  }

  const showForm = editingProfile || !profile;
  const version = Constants.expoConfig?.version ?? '';
  const catalogTotal = Object.values(CATALOG_COUNTS as Record<string, number>).reduce((sum, n) => sum + n, 0);
  const catalogUnavailable = getCatalogProblem() !== null;

  return (
    <Screen>
      <Animated.View entering={staggerIn(0)}>
        <Card style={styles.hero} variant="hero">
          <View style={styles.avatar}>
            {initial ? (
              <Text style={styles.avatarInitial}>{initial}</Text>
            ) : (
              <Ionicons color={colors.onHero} name="leaf" size={28} />
            )}
          </View>
          <View style={styles.heroCopy}>
            <Text accessibilityRole="header" numberOfLines={1} style={styles.heroName}>
              {name ?? 'Tu perfil'}
            </Text>
            <View style={styles.heroStatsRow}>
              <Ionicons color={colors.celebrate} name="flame" size={16} />
              <Text style={styles.heroStats}>
                {streak} {streak === 1 ? 'día' : 'días'} de racha · {loggedDays}{' '}
                {loggedDays === 1 ? 'día registrado' : 'días registrados'}
              </Text>
            </View>
          </View>
          <AnimatedPressable
            accessibilityLabel="Cambiar nombre"
            accessibilityRole="button"
            haptic
            onPress={() => setNameDraft(name ?? '')}
            style={styles.editName}
          >
            <Ionicons color={colors.onHero} name="pencil" size={18} />
          </AnimatedPressable>
        </Card>
      </Animated.View>

      {error && !profile ? <ErrorState message={error} onRetry={() => void load()} /> : null}

      {error && profile ? (
        <Card style={styles.errorBanner}>
          <Text style={styles.errorBannerText}>{error}</Text>
        </Card>
      ) : null}

      {goals ? (
        <Animated.View entering={staggerIn(1)}>
          <GoalsSummary goalText={describeGoal(profile)} goals={goals} />
        </Animated.View>
      ) : null}

      <Animated.View entering={staggerIn(2)} style={styles.section}>
        {showForm ? (
          <>
            <ProfileForm
              key={profileKey(profile)}
              initial={profile}
              onSubmit={(data, meta) => void handleSave(data, meta)}
              saving={saving}
            />
            {profile ? (
              <Button title="Cancelar" variant="ghost" onPress={() => setEditingProfile(false)} />
            ) : null}
          </>
        ) : (
          <Button
            icon="create-outline"
            title="Editar mis datos y objetivo"
            variant="secondary"
            onPress={() => setEditingProfile(true)}
          />
        )}
      </Animated.View>

      <Animated.View entering={staggerIn(3)}>
        <RemindersCard key={restoreCount} />
      </Animated.View>

      <Animated.View entering={staggerIn(4)}>
        <Card>
          <SectionHeader title="Apariencia" />
          <Segmented
            accessibilityLabel="Tema de la aplicación"
            onChange={(value) => void handleThemeChange(value)}
            options={THEME_OPTIONS}
            value={preference}
          />
        </Card>
      </Animated.View>

      <Animated.View entering={staggerIn(5)}>
        <Card>
          <SectionHeader caption="Cuánta agua quieres beber al día" title="Objetivo de agua" />
          <View style={styles.waterRow}>
            <TextField
              accessibilityLabel="Objetivo de agua en mililitros"
              keyboardType="number-pad"
              label="Mililitros por día"
              onChangeText={setWaterGoalDraft}
              placeholder={String(storedWaterGoal)}
              style={styles.waterField}
              value={waterGoalDraft ?? String(storedWaterGoal)}
            />
            <Button size="small" title="Guardar" onPress={handleWaterGoalChange} />
          </View>
        </Card>
      </Animated.View>

      <Animated.View entering={staggerIn(6)}>
        <BackupCard
          onRestored={() => {
            void load();
            // The copy may carry another name, water goal and reminder settings: reload
            // them, or the next edit would save the old values over the restored ones.
            reloadName();
            void reloadWaterGoal();
            setRestoreCount((count) => count + 1);
            void scheduleReminders(database);
          }}
        />
      </Animated.View>

      <Animated.View entering={staggerIn(7)}>
        <Card>
          <SectionHeader title="Acerca de JfooD" />
          <Text style={styles.aboutText}>
            Tus datos se quedan en este móvil: no hay cuenta ni nube. Las funciones con
            internet (escáner, código de barras) solo envían la imagen o el código que tú eliges.
          </Text>
          <Text style={styles.aboutText}>
            🥗 El catálogo reúne {catalogTotal.toLocaleString('es-ES')} alimentos con calorías y
            macros, para que no tengas que escribirlos. Los valores son orientativos: compruébalos
            con la etiqueta si te importa el dato exacto.
          </Text>
          {catalogUnavailable ? (
            <Text style={styles.aboutWarning}>
              El catálogo ampliado no se ha podido cargar en este móvil. Puedes seguir usando tus
              alimentos y los básicos que trae la app.
            </Text>
          ) : null}
          <Text style={styles.aboutText}>
            Alimentos genéricos: U.S. Department of Agriculture, Agricultural Research Service,
            Beltsville Human Nutrition Research Center. FoodData Central (dominio público),
            traducido al español.
          </Text>
          <Pressable
            accessibilityLabel="Abrir FoodData Central"
            accessibilityRole="link"
            onPress={() => void Linking.openURL('https://fdc.nal.usda.gov/')}
          >
            <Text style={styles.aboutLink}>fdc.nal.usda.gov</Text>
          </Pressable>
          <Text style={styles.aboutText}>
            Productos de supermercado: contiene datos de Open Food Facts, disponibles bajo la Open
            Database License (ODbL).
          </Text>
          <Pressable
            accessibilityLabel="Abrir Open Food Facts"
            accessibilityRole="link"
            onPress={() => void Linking.openURL('https://world.openfoodfacts.org/')}
          >
            <Text style={styles.aboutLink}>openfoodfacts.org</Text>
          </Pressable>
          <Pressable
            accessibilityLabel="Abrir la licencia ODbL"
            accessibilityRole="link"
            onPress={() => void Linking.openURL('https://opendatacommons.org/licenses/odbl/1-0/')}
          >
            <Text style={styles.aboutLink}>Licencia ODbL 1.0</Text>
          </Pressable>
          <Text style={styles.aboutText}>
            Tus objetivos se calculan con la ecuación de Mifflin-St Jeor a partir de tu peso,
            altura, edad, sexo y nivel de actividad. Son una guía, no un consejo médico.
          </Text>
          {version ? <Text style={styles.version}>Versión {version}</Text> : null}
        </Card>
      </Animated.View>

      <BottomSheet
        onClose={() => {
          setNameDraft(null);
          setNameError(null);
        }}
        title="¿Cómo te llamamos?"
        visible={nameDraft !== null}
      >
        <TextField
          accessibilityLabel="Tu nombre"
          autoCapitalize="words"
          autoFocus
          error={nameError}
          inputStyle={styles.nameInput}
          maxLength={20}
          onChangeText={(text: string) => {
            setNameDraft(text);
            setNameError(null);
          }}
          onSubmitEditing={() => void handleNameSave()}
          placeholder="Tu nombre"
          returnKeyType="done"
          value={nameDraft ?? ''}
        />
        <Text style={styles.aboutText}>Una palabra, hasta 20 letras. Se usa para saludarte.</Text>
        <Button title="Guardar" onPress={() => void handleNameSave()} />
      </BottomSheet>
    </Screen>
  );
}

/** Remounts the form when the stored profile changes elsewhere. */
function profileKey(profile: Parameters<typeof ProfileForm>[0]['initial']): string {
  if (!profile) return 'empty';
  return [
    profile.weightKg,
    profile.heightCm,
    profile.birthDate,
    profile.variant,
    profile.activityLevel,
  ].join('|');
}

function describeGoal(profile: Parameters<typeof profileKey>[0]): string | null {
  if (!profile || profile.goalType === 'maintain') return 'Objetivo: mantener el peso';
  const rate = String(profile.weeklyRateKg).replace('.', ',');
  return profile.goalType === 'lose'
    ? `Objetivo: perder ${rate} kg por semana`
    : `Objetivo: ganar ${rate} kg por semana`;
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    hero: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: spacing.lg,
    },
    avatar: {
      alignItems: 'center',
      backgroundColor: onHeroTrack,
      borderRadius: radius.pill,
      height: 64,
      justifyContent: 'center',
      width: 64,
    },
    avatarInitial: {
      color: colors.onHero,
      fontFamily: fonts.brand,
      fontSize: fontSizes.titleLarge,
    },
    heroCopy: {
      flex: 1,
      gap: spacing.xs,
    },
    heroName: {
      color: colors.onHero,
      fontFamily: fonts.heading,
      fontSize: fontSizes.heading,
    },
    heroStatsRow: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: spacing.xs,
    },
    heroStats: {
      ...typography.caption,
      color: colors.onHeroMuted,
      flex: 1,
    },
    editName: {
      alignItems: 'center',
      backgroundColor: onHeroTrack,
      borderRadius: radius.pill,
      height: 44,
      justifyContent: 'center',
      width: 44,
    },
    section: {
      gap: spacing.sm,
    },
    errorBanner: {
      backgroundColor: colors.dangerLight,
    },
    errorBannerText: {
      color: colors.danger,
      fontSize: fontSizes.caption,
      fontFamily: fonts.regular,
      lineHeight: 20,
      textAlign: 'center',
    },
    label: {
      ...typography.body,
      color: colors.text,
      fontFamily: fonts.heading,
      marginTop: spacing.md,
    },
    waterRow: {
      alignItems: 'flex-end',
      flexDirection: 'row',
      gap: spacing.md,
    },
    waterField: {
      flex: 1,
    },
    nameInput: {
      fontSize: fontSizes.title,
    },
    aboutText: {
      ...typography.caption,
      color: colors.textMuted,
      lineHeight: 19,
    },
    aboutWarning: {
      ...typography.caption,
      color: colors.warning,
      lineHeight: 19,
    },
    aboutLink: {
      ...typography.caption,
      color: colors.primary,
      minHeight: 44,
      paddingVertical: spacing.md,
      textDecorationLine: 'underline',
    },
    version: {
      ...typography.caption,
      color: colors.textMuted,
      textAlign: 'center',
    },
  });
}
