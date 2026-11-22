import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
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

import { runInTransaction } from '@/data/sqlite/utils/transaction';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { EmptyState } from '@/components/EmptyState';
import { Screen } from '@/components/Screen';
import { ScreenHeader } from '@/components/ScreenHeader';
import { useToast } from '@/components/Toast';
import { addEntry } from '@/data/sqlite/repositories/diaryRepository';
import { addPlanEntry } from '@/data/sqlite/repositories/planRepository';
import { generateId } from '@/data/sqlite/utils/id';
import { isScannerEnabled } from '@/config/api';
import { createFood } from '@/data/sqlite/repositories/foodRepository';
import {
  getSetting,
  setSetting,
} from '@/data/sqlite/repositories/settingsRepository';
import { normalizeName } from '@/features/foods/utils/normalize';
import type { Food } from '@/features/foods/types';
import { hapticSuccess } from '@/features/haptics/haptics';
import { scheduleReminders } from '@/features/reminders/notifications';
import { durations, easings } from '@/features/motion/motion';
import { MEALS, type MealType } from '@/features/diary/types';
import { isValidLocalDate, toLocalDate } from '@/features/diary/utils/date';
import { currentDefaultMeal } from '@/features/diary/utils/meals';
import {
  recognizeImage,
  recognizeText,
  warmUpServer,
} from '@/features/scanner/api/recognize';
import { useImagePicker } from '@/features/scanner/hooks/useImagePicker';
import type {
  RecognitionResult,
  RecognizedFood,
  RecognizedFoodMatch,
} from '@/features/scanner/types';
import { findLocalFoodMatch } from '@/features/scanner/utils/matchFood';
import {
  describeGramsError,
  parseGrams,
  removeMatch,
  setMatchGrams,
} from '@/features/scanner/utils/matches';
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
  'Para identificar los alimentos, la foto o el texto se envía a tu servidor de JfooD y de ahí a Google (Gemini). El servidor no lo guarda. Según las condiciones de Google para el nivel gratuito, Google puede usar el contenido para mejorar sus productos. No hagas fotos de personas ni de documentos.';

export default function ScannerScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { showToast } = useToast();
  const scannerEnabled = isScannerEnabled();
  const database = useSQLiteContext();
  const { date, meal, target } = useLocalSearchParams<{
    date?: string;
    meal?: string;
    target?: string;
  }>();
  /** Opened from the planner: the foods go to the plan, not to the diary. */
  const isPlanTarget = target === 'plan';

  const localDate =
    date && isValidLocalDate(date) ? date : toLocalDate(new Date());
  const initialMeal: MealType =
    MEALS.map((m) => m.type).includes(meal as MealType) ?
      (meal as MealType)
    : currentDefaultMeal();

  const { picking, launchCamera, launchLibrary } = useImagePicker();

  // Wake the (free-tier) server while the person frames the photo.
  useEffect(() => {
    if (scannerEnabled) {
      warmUpServer();
    }
  }, [scannerEnabled]);

  const [step, setStep] = useState<ScannerStep>('camera');
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [matches, setMatches] = useState<RecognizedFoodMatch[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [targetMeal, setTargetMeal] = useState<MealType>(initialMeal);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  // Rows whose typed amount is not a valid portion (keyed by match id).
  const [invalidIds, setInvalidIds] = useState<Record<string, boolean>>({});
  const analyzeRequestRef = useRef(0);
  /** Aborts the running request when the screen closes (it would still spend the Gemini budget). */
  const abortRef = useRef<AbortController | null>(null);
  /** Set at once: two quick taps on "Añadir" must save once. */
  const savingRef = useRef(false);
  /** The unmatched row sent to the manual flow; dropped only if a food really gets created. */
  const pendingManualRef = useRef<{ id: string; recognized: RecognizedFood } | null>(null);
  const [mealText, setMealText] = useState('');
  const [consentPending, setConsentPending] = useState<
    'camera' | 'library' | 'text' | null
  >(null);

  useEffect(() => () => abortRef.current?.abort(), []);

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

  /** Runs a recognition request (photo or text) and resolves the foods against the catalog. */
  const analyze = useCallback(
    async (
      request: (signal: AbortSignal) => Promise<RecognitionResult>,
      fallback: string,
    ) => {
      analyzeRequestRef.current += 1;
      const requestId = analyzeRequestRef.current;
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      setStep('analyzing');
      setErrorMessage(null);

      try {
        const result = await request(controller.signal);
        if (requestId !== analyzeRequestRef.current) return;

        const resolved = await Promise.all(
          result.foods.map(async (food: RecognizedFood) => {
            const matched = await findLocalFoodMatch(database, food);
            return {
              id: generateId(),
              recognized: food,
              food: matched,
              grams: food.estimatedGrams,
              confidence: food.confidence,
            } satisfies RecognizedFoodMatch;
          }),
        );

        if (requestId !== analyzeRequestRef.current) return;

        setMatches(resolved);
        setInvalidIds({});
        setWarnings(result.warnings);
        setStep('results');
      } catch (error) {
        if (requestId !== analyzeRequestRef.current) return;
        setErrorMessage(error instanceof Error ? error.message : fallback);
        setStep('error');
      }
    },
    [database],
  );

  const handleAnalyze = useCallback(async () => {
    if (!imageBase64) return;
    await analyze(
      (signal) => recognizeImage(imageBase64, signal),
      'No se ha podido analizar la imagen.',
    );
  }, [analyze, imageBase64]);

  const handleAnalyzeText = useCallback(async () => {
    const text = mealText.trim();
    if (text.length < 2) return;
    await analyze(
      (signal) => recognizeText(text, signal),
      'No se ha podido interpretar el texto.',
    );
  }, [analyze, mealText]);

  const startCamera = useCallback(async () => {
    const result = await launchCamera();
    await handleImage(result);
  }, [launchCamera, handleImage]);

  const startLibrary = useCallback(async () => {
    const result = await launchLibrary();
    await handleImage(result);
  }, [launchLibrary, handleImage]);

  const runSource = useCallback(
    async (source: 'camera' | 'library' | 'text') => {
      if (source === 'camera') await startCamera();
      else if (source === 'library') await startLibrary();
      else await handleAnalyzeText();
    },
    [startCamera, startLibrary, handleAnalyzeText],
  );

  // The first photo is only sent after the person has read where it goes.
  const requestPick = useCallback(
    async (source: 'camera' | 'library' | 'text') => {
      let acknowledged: string | null = null;
      try {
        acknowledged = await getSetting(database, PRIVACY_ACK_KEY);
      } catch {
        acknowledged = null;
      }

      if (acknowledged === '1') {
        await runSource(source);
        return;
      }
      setConsentPending(source);
    },
    [database, runSource],
  );

  const handleCamera = useCallback(() => requestPick('camera'), [requestPick]);
  const handleLibrary = useCallback(() => requestPick('library'), [requestPick]);
  const handleText = useCallback(() => requestPick('text'), [requestPick]);

  const handleConsentConfirm = async () => {
    const source = consentPending;
    setConsentPending(null);
    if (!source) return;

    try {
      await setSetting(database, PRIVACY_ACK_KEY, '1');
    } catch {
      // Not persisting only means the notice is shown again next time.
    }
    await runSource(source);
  };

  const updateGrams = (id: string, text: string) => {
    const grams = parseGrams(text);
    setInvalidIds((previous) => ({ ...previous, [id]: grams === null }));
    if (grams !== null) {
      setMatches((previous) => setMatchGrams(previous, id, grams));
    }
  };

  const canSave = useMemo(
    () =>
      matches.length > 0 &&
      matches.every((m) => m.grams > 0 && !invalidIds[m.id]),
    [matches, invalidIds],
  );

  const handleSave = async () => {
    if (!canSave || savingRef.current) return;
    savingRef.current = true;

    setSaving(true);
    try {
      await runInTransaction(database, async () => {
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

          const entry = {
            localDate,
            mealType: targetMeal,
            food,
            grams: match.grams,
          };
          if (isPlanTarget) {
            await addPlanEntry(database, entry);
          } else {
            await addEntry(database, entry);
          }
        }
      });

      void scheduleReminders(database);
      hapticSuccess();
      showToast(isPlanTarget ? 'Añadido al plan.' : 'Añadido al diario.');
      router.back();
    } catch {
      savingRef.current = false;
      setSaving(false);
      showToast('No se han podido añadir los alimentos.', 'error');
    }
  };

  const handleManualCreate = (recognizedName: string, id?: string) => {
    // The row stays until the food is really created (see the focus effect below):
    // backing out of the manual flow must not lose it.
    const row = id === undefined ? undefined : matches.find((m) => m.id === id);
    pendingManualRef.current = row ? { id: row.id, recognized: row.recognized } : null;
    router.push({
      pathname: '/diary/add-food',
      params: {
        date: localDate,
        meal: targetMeal,
        create: '1',
        ...(isPlanTarget ? { target: 'plan' } : {}),
        ...(recognizedName ? { name: recognizedName } : {}),
      },
    });
  };

  // Back from the manual flow: if the food now exists, that flow already added it.
  useFocusEffect(
    useCallback(() => {
      const pending = pendingManualRef.current;
      if (!pending) return;
      pendingManualRef.current = null;
      void findLocalFoodMatch(database, pending.recognized)
        .then((created) => {
          if (!created) return;
          setMatches((previous) => removeMatch(previous, pending.id));
          setInvalidIds((previous) => {
            const { [pending.id]: _removed, ...rest } = previous;
            return rest;
          });
        })
        .catch(() => undefined);
    }, [database]),
  );

  const reset = () => {
    analyzeRequestRef.current += 1;
    setImageUri(null);
    setImageBase64(null);
    setMatches([]);
    setInvalidIds({});
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
            mealText={mealText}
            onAnalyzeText={handleText}
            onCamera={handleCamera}
            onChangeText={setMealText}
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
          onChangeMeal={setTargetMeal}
          onManualCreate={handleManualCreate}
          onRetake={reset}
        />
      ) : null}

      {step === 'error' ? (
        <ErrorStep
          message={errorMessage}
          onManual={() => handleManualCreate('')}
          retryLabel={imageBase64 || mealText.trim().length >= 2 ? 'Reintentar' : undefined}
          onRetry={() => {
            if (imageBase64) void handleAnalyze();
            else if (mealText.trim().length >= 2) void handleAnalyzeText();
            else reset();
          }}
          onOther={reset}
        />
      ) : null}

      {step === 'results' ? (
        <View style={styles.saveRow}>
          <Button
            disabled={!canSave || saving}
            loading={saving}
            title={isPlanTarget ? 'Añadir al plan' : 'Añadir al diario'}
            onPress={handleSave}
          />
        </View>
      ) : null}
      <ConfirmDialog
        confirmLabel="Entendido, continuar"
        message={PRIVACY_MESSAGE}
        title="Antes de enviar la foto o el texto"
        visible={consentPending !== null}
        onClose={() => setConsentPending(null)}
        onConfirm={() => void handleConsentConfirm()}
      />
    </Screen>
  );
}

function CameraStep({
  loading,
  mealText,
  onAnalyzeText,
  onCamera,
  onChangeText,
  onLibrary,
}: {
  loading: boolean;
  mealText: string;
  onAnalyzeText: () => void;
  onCamera: () => void;
  onChangeText: (text: string) => void;
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

      <Card style={styles.cameraCard}>
        <Text style={styles.cameraTitle}>O descríbela con texto</Text>
        <TextInput
          accessibilityLabel="Describe lo que has comido"
          maxLength={500}
          multiline
          onChangeText={onChangeText}
          placeholder="Ej. 2 huevos revueltos y un café con leche"
          placeholderTextColor={colors.textMuted}
          style={styles.textArea}
          value={mealText}
        />
        <Button
          disabled={loading || mealText.trim().length < 2}
          icon="sparkles-outline"
          title="Interpretar texto"
          variant="secondary"
          onPress={onAnalyzeText}
        />
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
  onChangeMeal,
  onManualCreate,
  onRetake,
}: {
  matches: RecognizedFoodMatch[];
  targetMeal: MealType;
  warnings: string[];
  onChangeGrams: (id: string, text: string) => void;
  onChangeMeal: (meal: MealType) => void;
  onManualCreate: (name: string, id: string) => void;
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
          {matches.map((match) => (
            <ResultRow
              key={match.id}
              grams={match.grams}
              id={match.id}
              confidence={match.confidence}
              matched={match.food !== null}
              name={match.food?.name ?? match.recognized.name}
              originalName={match.recognized.name}
              onChangeGrams={onChangeGrams}
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
  id,
  matched,
  name,
  originalName,
  onChangeGrams,
  onManualCreate,
}: {
  confidence: number | null;
  grams: number;
  id: string;
  matched: boolean;
  name: string;
  originalName: string;
  onChangeGrams: (id: string, text: string) => void;
  onManualCreate: (name: string, id: string) => void;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [text, setText] = useState(String(grams));

  const gramsError = describeGramsError(text);

  const handleChange = (value: string) => {
    setText(value);
    onChangeGrams(id, value);
  };

  // An invalid amount goes back to the last valid one (never silently to 1 g).
  const handleEndEditing = () => {
    if (gramsError !== null) {
      setText(String(grams));
      onChangeGrams(id, String(grams));
    }
  };

  return (
    <View style={styles.resultRow}>
      <View style={styles.resultInfo}>
        <Text style={styles.resultName}>{name}</Text>
        {gramsError !== null ? (
          <Text style={styles.resultError}>{gramsError}</Text>
        ) : null}
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
          style={[styles.gramsInput, gramsError !== null && styles.gramsInputInvalid]}
          value={text}
        />
        <Text style={styles.gramsLabel}>g</Text>
        {!matched ? (
          <Pressable
            accessibilityLabel="Introducir datos manualmente"
            accessibilityRole="button"
            hitSlop={8}
            onPress={() => onManualCreate(originalName, id)}
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
  onOther,
  retryLabel,
}: {
  message: string | null;
  onManual: () => void;
  onRetry: () => void;
  /** Starts over with another photo or text (only offered when "retry" keeps the current one). */
  onOther?: () => void;
  retryLabel?: string;
}) {
  return (
    <View style={useStyles().errorStep}>
      <EmptyState
        actionLabel={retryLabel ?? 'Intentar de nuevo'}
        icon="alert-circle-outline"
        message={
          message ??
          'No se ha podido analizar la imagen. Comprueba tu conexión o inténtalo más tarde.'
        }
        title="Error de análisis"
        onAction={onRetry}
      />
      {retryLabel ? (
        <Button
          icon="camera-outline"
          title="Otra foto o texto"
          variant="secondary"
          onPress={onOther ?? onRetry}
        />
      ) : null}
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
    textArea: {
      backgroundColor: colors.surfaceMuted,
      borderColor: colors.border,
      borderRadius: radius.md,
      borderWidth: 1,
      color: colors.text,
      fontSize: 16,
      minHeight: 88,
      padding: spacing.md,
      textAlignVertical: 'top',
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
    gramsInputInvalid: {
      borderColor: colors.danger,
    },
    resultError: {
      color: colors.danger,
      fontSize: 12,
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
