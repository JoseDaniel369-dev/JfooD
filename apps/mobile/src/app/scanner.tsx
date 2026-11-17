import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Image,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { EmptyState } from '@/components/EmptyState';
import { Screen } from '@/components/Screen';
import { ScreenHeader } from '@/components/ScreenHeader';
import { useToast } from '@/components/Toast';
import { addEntry } from '@/data/sqlite/repositories/diaryRepository';
import { isScannerEnabled } from '@/config/api';
import { createFood } from '@/data/sqlite/repositories/foodRepository';
import {
  getSetting,
  setSetting,
} from '@/data/sqlite/repositories/settingsRepository';
import { normalizeName } from '@/features/foods/utils/normalize';
import type { Food } from '@/features/foods/types';
import { hapticSuccess } from '@/features/haptics/haptics';
import { durations, easings } from '@/features/motion/motion';
import { MEALS, type MealType } from '@/features/diary/types';
import { isValidLocalDate, toLocalDate } from '@/features/diary/utils/date';
import { recognizeImage } from '@/features/scanner/api/recognize';
import { useImagePicker } from '@/features/scanner/hooks/useImagePicker';
import type { RecognizedFood, RecognizedFoodMatch } from '@/features/scanner/types';
import { findLocalFoodMatch } from '@/features/scanner/utils/matchFood';
import {
  radius,
  spacing,
  typography,
  useTheme,
  type ThemeColors,
} from '@/theme';

type ScannerStep = 'camera' | 'preview' | 'analyzing' | 'results' | 'error';

const PRIVACY_ACK_KEY = 'scanner_privacy_ack';

const PRIVACY_MESSAGE =
  'Para identificar los alimentos, la foto se envía a tu servidor de JfooD y de ahí a Google (Gemini). El servidor no la guarda. Según las condiciones de Google para el nivel gratuito, Google puede usar el contenido para mejorar sus productos. No hagas fotos de personas ni de documentos.';

export default function ScannerScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { showToast } = useToast();
  const scannerEnabled = isScannerEnabled();
  const database = useSQLiteContext();
  const { date, meal } = useLocalSearchParams<{
    date?: string;
    meal?: string;
  }>();

  const localDate =
    date && isValidLocalDate(date) ? date : toLocalDate(new Date());
  const initialMeal: MealType =
    MEALS.map((m) => m.type).includes(meal as MealType) ?
      (meal as MealType)
    : 'breakfast';

  const { picking, launchCamera, launchLibrary } = useImagePicker();

  const [step, setStep] = useState<ScannerStep>('camera');
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [matches, setMatches] = useState<RecognizedFoodMatch[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [targetMeal, setTargetMeal] = useState<MealType>(initialMeal);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const analyzeRequestRef = useRef(0);
  const [consentPending, setConsentPending] = useState<
    'camera' | 'library' | null
  >(null);

  const handleImage = useCallback(
    async (result: Awaited<ReturnType<typeof launchCamera>>) => {
      if (result === 'permission_denied') {
        Alert.alert(
          'Permiso necesario',
          'Necesitamos acceso a la cámara o galería para analizar la comida.',
        );
        return;
      }

      if (result === 'no_image') {
        return;
      }

      if (result === 'unknown') {
        showToast('No se ha podido procesar la imagen.', 'error');
        return;
      }

      setImageUri(result.uri);
      setImageBase64(result.base64);
      setStep('preview');
    },
    [showToast],
  );

  const startCamera = useCallback(async () => {
    const result = await launchCamera();
    await handleImage(result);
  }, [launchCamera, handleImage]);

  const startLibrary = useCallback(async () => {
    const result = await launchLibrary();
    await handleImage(result);
  }, [launchLibrary, handleImage]);

  // The first photo is only sent after the person has read where it goes.
  const requestPick = useCallback(
    async (source: 'camera' | 'library') => {
      let acknowledged: string | null = null;
      try {
        acknowledged = await getSetting(database, PRIVACY_ACK_KEY);
      } catch {
        acknowledged = null;
      }

      if (acknowledged === '1') {
        await (source === 'camera' ? startCamera() : startLibrary());
        return;
      }
      setConsentPending(source);
    },
    [database, startCamera, startLibrary],
  );

  const handleCamera = useCallback(() => requestPick('camera'), [requestPick]);
  const handleLibrary = useCallback(() => requestPick('library'), [requestPick]);

  const handleConsentConfirm = async () => {
    const source = consentPending;
    setConsentPending(null);
    if (!source) return;

    try {
      await setSetting(database, PRIVACY_ACK_KEY, '1');
    } catch {
      // Not persisting only means the notice is shown again next time.
    }
    await (source === 'camera' ? startCamera() : startLibrary());
  };

  const handleAnalyze = useCallback(async () => {
    if (!imageBase64) return;

    analyzeRequestRef.current += 1;
    const requestId = analyzeRequestRef.current;

    setStep('analyzing');
    setErrorMessage(null);

    try {
      const result = await recognizeImage(imageBase64);
      if (requestId !== analyzeRequestRef.current) return;

      const resolved = await Promise.all(
        result.foods.map(async (food: RecognizedFood) => {
          const matched = await findLocalFoodMatch(database, food);
          return {
            recognized: food,
            food: matched,
            grams: food.estimatedGrams,
            confidence: food.confidence,
          } satisfies RecognizedFoodMatch;
        }),
      );

      if (requestId !== analyzeRequestRef.current) return;

      setMatches(resolved);
      setWarnings(result.warnings);
      setStep('results');
    } catch (error) {
      if (requestId !== analyzeRequestRef.current) return;
      setErrorMessage(
        error instanceof Error ?
          error.message
        : 'No se ha podido analizar la imagen.',
      );
      setStep('error');
    }
  }, [database, imageBase64]);

  const updateGrams = (index: number, value: string) => {
    setMatches((prev) => {
      const current = prev[index];
      if (!current) return prev;

      const next = [...prev];
      const normalized = value.replace(',', '.');
      const parsed = Number(normalized);
      next[index] = {
        ...current,
        grams: Number.isFinite(parsed) && parsed > 0 ? parsed : current.grams,
      };
      return next;
    });
  };

  const updateGramsCommit = (index: number, grams: number) => {
    setMatches((prev) => {
      const current = prev[index];
      if (!current) return prev;

      const next = [...prev];
      next[index] = {
        ...current,
        grams: Number.isFinite(grams) && grams > 0 ? grams : 1,
      };
      return next;
    });
  };

  const canSave = useMemo(() => {
    return matches.length > 0 && matches.every((m) => m.grams > 0);
  }, [matches]);

  const handleSave = async () => {
    if (!canSave) return;

    setSaving(true);
    try {
      await database.withTransactionAsync(async () => {
        const createdByName = new Map<string, Food>();

        for (const match of matches) {
          let food = match.food;

          if (!food) {
            const key = normalizeName(match.recognized.name);
            food = createdByName.get(key) ?? null;
          }

          if (!food) {
            food = await createFood(database, {
              name: match.recognized.name,
              brand: null,
              caloriesKcal: null,
              proteinGrams: null,
              carbohydrateGrams: null,
              fatGrams: null,
            });
            createdByName.set(normalizeName(match.recognized.name), food);
          }

          await addEntry(database, {
            localDate,
            mealType: targetMeal,
            food,
            grams: match.grams,
          });
        }
      });

      hapticSuccess();
      showToast('Añadido al diario.');
      router.back();
    } catch {
      setSaving(false);
      showToast('No se han podido añadir los alimentos.', 'error');
    }
  };

  const handleManualCreate = (recognizedName: string, index?: number) => {
    if (index !== undefined) {
      // The food will be added from the manual flow: drop it here so it
      // cannot be saved twice when the person comes back.
      setMatches((previous) => previous.filter((_, i) => i !== index));
    }
    router.push({
      pathname: '/diary/add-food',
      params: { date: localDate, meal: targetMeal, name: recognizedName },
    });
  };

  const reset = () => {
    analyzeRequestRef.current += 1;
    setImageUri(null);
    setImageBase64(null);
    setMatches([]);
    setWarnings([]);
    setErrorMessage(null);
    setStep('camera');
  };

  return (
    <Screen>
      <ScreenHeader
        subtitle={
          scannerEnabled ?
            'Fotografía tu comida y Gemini identificará los alimentos.'
          : 'Añade alimentos manualmente a tu diario sin depender de la red.'
        }
        title={scannerEnabled ? 'Escáner' : 'Añadir alimento'}
      />

      {step === 'camera' ? (
        scannerEnabled ?
          <CameraStep
            loading={picking}
            onCamera={handleCamera}
            onLibrary={handleLibrary}
          />
        : <ManualOnlyStep onManual={() => handleManualCreate('')} />
      ) : null}

      {step === 'preview' && imageUri ? (
        <PreviewStep
          imageUri={imageUri}
          onAnalyze={handleAnalyze}
          onRetake={reset}
        />
      ) : null}

      {step === 'analyzing' ? <AnalyzingStep /> : null}

      {step === 'results' ? (
        <ResultsStep
          matches={matches}
          targetMeal={targetMeal}
          warnings={warnings}
          onChangeGrams={updateGrams}
          onCommitGrams={updateGramsCommit}
          onChangeMeal={setTargetMeal}
          onManualCreate={handleManualCreate}
          onRetake={reset}
        />
      ) : null}

      {step === 'error' ? (
        <ErrorStep
          message={errorMessage}
          onManual={() => handleManualCreate('')}
          onRetry={reset}
        />
      ) : null}

      {step === 'results' ? (
        <View style={styles.saveRow}>
          <Button
            disabled={!canSave || saving}
            loading={saving}
            title="Añadir al diario"
            onPress={handleSave}
          />
        </View>
      ) : null}
      <ConfirmDialog
        confirmLabel="Entendido, continuar"
        message={PRIVACY_MESSAGE}
        title="Antes de enviar la foto"
        visible={consentPending !== null}
        onClose={() => setConsentPending(null)}
        onConfirm={() => void handleConsentConfirm()}
      />
    </Screen>
  );
}

function CameraStep({
  loading,
  onCamera,
  onLibrary,
}: {
  loading: boolean;
  onCamera: () => void;
  onLibrary: () => void;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <View style={styles.cameraStep}>
      <Card style={styles.cameraCard}>
        <View style={styles.iconContainer}>
          <Ionicons color={colors.primary} name="camera-outline" size={42} />
        </View>
        <Text style={styles.cameraTitle}>Captura tu comida</Text>
        <Text style={styles.cameraDescription}>
          Haz una foto o elige una imagen de tu galería. Gemini estimará los
          alimentos y sus gramos, pero nunca generará valores nutricionales.
        </Text>

        <View style={styles.cameraButtons}>
          <Button
            disabled={loading}
            icon="camera-outline"
            title="Hacer foto"
            onPress={onCamera}
          />
          <Button
            disabled={loading}
            icon="images-outline"
            title="Elegir de galería"
            variant="secondary"
            onPress={onLibrary}
          />
        </View>
      </Card>

      <View style={styles.notice}>
        <Ionicons color={colors.primary} name="information-circle-outline" size={20} />
        <Text style={styles.noticeText}>
          Las cantidades detectadas en una fotografía siempre serán aproximadas.
          Revisa los gramos antes de guardar. La foto se envía a Google (Gemini)
          para identificar los alimentos.
        </Text>
      </View>
    </View>
  );
}

function ManualOnlyStep({ onManual }: { onManual: () => void }) {
  return (
    <EmptyState
      actionLabel="Añadir alimento manualmente"
      icon="create-outline"
      message="Esta versión funciona sin conexión. Puedes añadir alimentos manualmente al diario."
      title="Escáner no disponible"
      onAction={onManual}
    />
  );
}

function PreviewStep({
  imageUri,
  onAnalyze,
  onRetake,
}: {
  imageUri: string;
  onAnalyze: () => void;
  onRetake: () => void;
}) {
  const styles = useStyles();
  const [opacity] = useState(() => new Animated.Value(0));
  const [scale] = useState(() => new Animated.Value(0.96));

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: durations.normal,
        useNativeDriver: true,
      }),
      Animated.timing(scale, {
        toValue: 1,
        duration: durations.normal,
        useNativeDriver: true,
        easing: (x) => easings.easeOutBack(x),
      }),
    ]).start();
  }, [opacity, scale]);

  return (
    <View style={styles.previewStep}>
      <Animated.View style={{ opacity, transform: [{ scale }] }}>
        <Image source={{ uri: imageUri }} style={styles.previewImage} />
      </Animated.View>
      <View style={styles.previewButtons}>
        <View style={styles.buttonFlex}>
          <Button title="Otra foto" variant="secondary" onPress={onRetake} />
        </View>
        <View style={styles.buttonFlex}>
          <Button icon="scan-outline" title="Analizar" onPress={onAnalyze} />
        </View>
      </View>
    </View>
  );
}

function AnalyzingStep() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [shimmer] = useState(() => new Animated.Value(0));

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmer, {
          toValue: 1,
          duration: 1200,
          useNativeDriver: true,
        }),
        Animated.timing(shimmer, {
          toValue: 0,
          duration: 1200,
          useNativeDriver: true,
        }),
      ]),
    );
    animation.start();
    return () => animation.stop();
  }, [shimmer]);

  return (
    <View style={styles.centered}>
      <ActivityIndicator color={colors.primary} size="large" />
      <Animated.View
        style={[
          styles.skeleton,
          {
            backgroundColor: colors.surfaceMuted,
            opacity: shimmer.interpolate({
              inputRange: [0, 1],
              outputRange: [0.5, 1],
            }),
          },
        ]}
      />
      <Text style={styles.analyzingText}>Analizando imagen…</Text>
      <Text style={styles.analyzingSubtext}>
        Esto puede tardar unos segundos.
      </Text>
    </View>
  );
}

function ResultsStep({
  matches,
  targetMeal,
  warnings,
  onChangeGrams,
  onCommitGrams,
  onChangeMeal,
  onManualCreate,
  onRetake,
}: {
  matches: RecognizedFoodMatch[];
  targetMeal: MealType;
  warnings: string[];
  onChangeGrams: (index: number, value: string) => void;
  onCommitGrams: (index: number, grams: number) => void;
  onChangeMeal: (meal: MealType) => void;
  onManualCreate: (name: string, index: number) => void;
  onRetake: () => void;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  if (matches.length === 0) {
    return (
      <EmptyState
        actionLabel="Probar otra foto"
        icon="sad-outline"
        message={
          warnings[0] ??
          'No se ha reconocido ningún alimento en la imagen.'
        }
        title="Sin resultados"
        onAction={onRetake}
      />
    );
  }

  return (
    <View style={styles.resultsStep}>
      <Card>
        <Text style={styles.sectionTitle}>Resultados del análisis</Text>
        {warnings.length > 0 ? (
          <View style={styles.warnings}>
            {warnings.map((warning, index) => (
              <View key={index} style={styles.warningRow}>
                <Ionicons color={colors.accent} name="warning-outline" size={16} />
                <Text style={styles.warningText}>{warning}</Text>
              </View>
            ))}
          </View>
        ) : null}

        <View style={styles.matchList}>
          {matches.map((match, index) => (
            <ResultRow
              key={index}
              grams={match.grams}
              index={index}
              confidence={match.confidence}
              matched={match.food !== null}
              name={match.food?.name ?? match.recognized.name}
              originalName={match.recognized.name}
              onChangeGrams={onChangeGrams}
              onCommitGrams={onCommitGrams}
              onManualCreate={onManualCreate}
            />
          ))}
        </View>
      </Card>

      <Card>
        <Text style={styles.sectionTitle}>Comida destino</Text>
        <View style={styles.mealOptions}>
          {MEALS.map(({ type, label }) => (
            <Pressable
              key={type}
              accessibilityRole="button"
              accessibilityState={{ selected: targetMeal === type }}
              onPress={() => onChangeMeal(type)}
              style={[
                styles.mealOption,
                targetMeal === type && styles.mealOptionSelected,
              ]}
            >
              <Text
                style={[
                  styles.mealOptionText,
                  targetMeal === type && styles.mealOptionTextSelected,
                ]}
              >
                {label}
              </Text>
            </Pressable>
          ))}
        </View>
      </Card>
    </View>
  );
}

function ResultRow({
  confidence,
  grams,
  index,
  matched,
  name,
  originalName,
  onChangeGrams,
  onCommitGrams,
  onManualCreate,
}: {
  confidence: number | null;
  grams: number;
  index: number;
  matched: boolean;
  name: string;
  originalName: string;
  onChangeGrams: (index: number, value: string) => void;
  onCommitGrams: (index: number, grams: number) => void;
  onManualCreate: (name: string, index: number) => void;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [text, setText] = useState(String(grams));

  const handleChange = (value: string) => {
    setText(value);
    onChangeGrams(index, value);
  };

  const handleEndEditing = () => {
    const normalized = text.replace(',', '.');
    const parsed = Number(normalized);
    const valid = Number.isFinite(parsed) && parsed > 0;
    onCommitGrams(index, valid ? parsed : 1);
    if (!valid) {
      setText('1');
    }
  };

  return (
    <View style={styles.resultRow}>
      <View style={styles.resultInfo}>
        <Text style={styles.resultName}>{name}</Text>
        {confidence !== null ? (
          <Text style={styles.resultConfidence}>
            {describeConfidence(confidence)}
          </Text>
        ) : null}
        {matched ? (
          <Text style={styles.resultMatch}>Coincide con tu catálogo local</Text>
        ) : (
          <Text style={styles.resultNoMatch}>
            No encontrado en el catálogo. Se creará como alimento nuevo.
          </Text>
        )}
      </View>

      <View style={styles.resultActions}>
        <TextInput
          accessibilityLabel={`Gramos de ${name}`}
          keyboardType="decimal-pad"
          onChangeText={handleChange}
          onEndEditing={handleEndEditing}
          style={styles.gramsInput}
          value={text}
        />
        <Text style={styles.gramsLabel}>g</Text>
        {!matched ? (
          <Pressable
            accessibilityLabel="Introducir datos manualmente"
            accessibilityRole="button"
            hitSlop={8}
            onPress={() => onManualCreate(originalName, index)}
            style={styles.manualButton}
          >
            <Ionicons color={colors.primary} name="create-outline" size={20} />
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

function describeConfidence(confidence: number): string {
  const percent = Math.round(confidence * 100);
  if (confidence >= 0.8) return `Confianza alta (${percent} %)`;
  if (confidence >= 0.5) return `Confianza media (${percent} %): revísalo`;
  return `Confianza baja (${percent} %): revisa nombre y gramos`;
}

function ErrorStep({
  message,
  onManual,
  onRetry,
}: {
  message: string | null;
  onManual: () => void;
  onRetry: () => void;
}) {
  return (
    <View style={useStyles().errorStep}>
      <EmptyState
        actionLabel="Intentar de nuevo"
        icon="alert-circle-outline"
        message={
          message ??
          'No se ha podido analizar la imagen. Comprueba tu conexión o inténtalo más tarde.'
        }
        title="Error de análisis"
        onAction={onRetry}
      />
      <Button
        icon="create-outline"
        title="Crear alimento manualmente"
        variant="secondary"
        onPress={onManual}
      />
    </View>
  );
}

function useStyles() {
  const { colors } = useTheme();
  return useMemo(() => createStyles(colors), [colors]);
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    cameraStep: {
      gap: spacing.lg,
    },
    cameraCard: {
      alignItems: 'center',
      gap: spacing.md,
    },
    iconContainer: {
      alignItems: 'center',
      backgroundColor: colors.primaryLight,
      borderRadius: radius.lg,
      height: 84,
      justifyContent: 'center',
      width: 84,
    },
    cameraTitle: {
      ...typography.title,
      color: colors.text,
      fontSize: 20,
    },
    cameraDescription: {
      ...typography.body,
      color: colors.textMuted,
      lineHeight: 22,
      textAlign: 'center',
    },
    cameraButtons: {
      gap: spacing.md,
      width: '100%',
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
    previewStep: {
      gap: spacing.lg,
    },
    previewImage: {
      borderRadius: radius.lg,
      height: 320,
      resizeMode: 'cover',
      width: '100%',
    },
    skeleton: {
      borderRadius: radius.md,
      height: 120,
      marginTop: spacing.lg,
      width: '100%',
    },
    previewButtons: {
      flexDirection: 'row',
      gap: spacing.md,
    },
    buttonFlex: {
      flex: 1,
    },
    centered: {
      alignItems: 'center',
      gap: spacing.md,
      justifyContent: 'center',
      minHeight: 240,
    },
    analyzingText: {
      ...typography.title,
      color: colors.text,
    },
    analyzingSubtext: {
      ...typography.body,
      color: colors.textMuted,
    },
    resultsStep: {
      gap: spacing.lg,
    },
    sectionTitle: {
      ...typography.title,
      color: colors.text,
    },
    warnings: {
      gap: spacing.sm,
    },
    warningRow: {
      alignItems: 'flex-start',
      backgroundColor: `${colors.accent}15`,
      borderRadius: radius.md,
      flexDirection: 'row',
      gap: spacing.sm,
      padding: spacing.md,
    },
    warningText: {
      ...typography.caption,
      color: colors.text,
      flex: 1,
      lineHeight: 18,
    },
    matchList: {
      gap: spacing.md,
    },
    resultRow: {
      alignItems: 'center',
      backgroundColor: colors.surfaceMuted,
      borderRadius: radius.md,
      flexDirection: 'row',
      gap: spacing.md,
      padding: spacing.md,
    },
    resultInfo: {
      flex: 1,
      gap: 2,
    },
    resultName: {
      color: colors.text,
      fontSize: 15,
      fontWeight: '600',
    },
    resultConfidence: {
      color: colors.textMuted,
      fontSize: 12,
    },
    resultMatch: {
      color: colors.success,
      fontSize: 12,
    },
    resultNoMatch: {
      color: colors.textMuted,
      fontSize: 12,
    },
    resultActions: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: spacing.sm,
    },
    gramsInput: {
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: radius.sm,
      borderWidth: 1,
      color: colors.text,
      fontSize: 15,
      fontWeight: '600',
      minWidth: 64,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      textAlign: 'center',
    },
    gramsLabel: {
      color: colors.textMuted,
      fontSize: 14,
    },
    manualButton: {
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: 48,
      minWidth: 48,
      padding: spacing.xs,
    },
    mealOptions: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.sm,
    },
    mealOption: {
      backgroundColor: colors.surfaceMuted,
      borderColor: colors.border,
      borderRadius: radius.md,
      borderWidth: 1,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
    },
    mealOptionSelected: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    mealOptionText: {
      color: colors.text,
      fontSize: 14,
      fontWeight: '600',
    },
    mealOptionTextSelected: {
      color: colors.textOnPrimary,
    },
    saveRow: {
      marginTop: 'auto',
    },
    errorStep: {
      gap: spacing.md,
    },
  });
}
