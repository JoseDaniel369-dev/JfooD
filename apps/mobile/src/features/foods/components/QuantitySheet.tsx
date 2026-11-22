import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { useSQLiteContext } from 'expo-sqlite';

import { BottomSheet } from '@/components/BottomSheet';
import { Button } from '@/components/Button';
import { Chip } from '@/components/Chip';
import { Segmented } from '@/components/Segmented';
import { getServings, type Serving } from '@/data/sqlite/repositories/servingRepository';
import { MEALS, type MealType } from '@/features/diary/types';
import { entryNutrients, formatGrams } from '@/features/diary/utils/totals';
import { foodNutrients, type Food } from '@/features/foods/types';
import { foodEmoji } from '@/features/foods/utils/foodEmoji';
import { hapticSelection } from '@/features/haptics/haptics';
import { describeGramsError, parseGrams } from '@/features/scanner/utils/matches';
import {
  radius,
  spacing,
  tabularNumbers,
  typography,
  useTheme,
  type ThemeColors,
} from '@/theme';

const QUICK_GRAMS = [50, 100, 150, 200] as const;

interface QuantitySheetProps {
  /** The food being added; null hides the sheet. */
  food: Food | null;
  initialMeal: MealType;
  /** "Añadido al plan" vs the diary, for the button text. */
  forPlan: boolean;
  /** How many foods were already added in this visit (for "Añadir y seguir"). */
  addedCount: number;
  onClose: () => void;
  /** Resolves when saved. `keepOpen` means: stay on the screen to add another. */
  onSubmit: (grams: number, meal: MealType, keepOpen: boolean) => Promise<void>;
}

/** Bottom sheet to choose how much of a food to add and to which meal. */
export function QuantitySheet({
  food,
  initialMeal,
  forPlan,
  addedCount,
  onClose,
  onSubmit,
}: QuantitySheetProps) {
  return (
    <BottomSheet onClose={onClose} visible={food !== null}>
      {food ? (
        // Keyed by food: choosing another food starts from a clean form.
        <QuantityForm
          key={food.id}
          addedCount={addedCount}
          food={food}
          forPlan={forPlan}
          initialMeal={initialMeal}
          onSubmit={onSubmit}
        />
      ) : null}
    </BottomSheet>
  );
}

function QuantityForm({
  food,
  initialMeal,
  forPlan,
  addedCount,
  onSubmit,
}: Omit<QuantitySheetProps, 'food' | 'onClose'> & { food: Food }) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const database = useSQLiteContext();

  const [servings, setServings] = useState<Serving[]>([]);
  const [text, setText] = useState('100');
  const [meal, setMeal] = useState<MealType>(initialMeal);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getServings(database, food.id)
      .then((rows) => {
        if (!cancelled) setServings(rows);
      })
      .catch(() => {
        // Without portions the quick amounts still work.
      });
    return () => {
      cancelled = true;
    };
  }, [database, food.id]);

  const grams = parseGrams(text);
  const error = grams === null ? describeGramsError(text) : null;
  const eaten = grams === null ? null : entryNutrients(foodNutrients(food), grams);

  const submit = async (keepOpen: boolean) => {
    if (grams === null || saving) return;
    setSaving(true);
    try {
      await onSubmit(grams, meal, keepOpen);
    } finally {
      setSaving(false);
    }
  };

  const pick = (value: number) => {
    hapticSelection();
    setText(String(value));
  };

  const mealOptions = MEALS.map(({ type, label }) => ({ value: type, label }));

  return (
    <View style={styles.form}>
      <View style={styles.titleRow}>
        <View style={styles.emoji}>
          <Text style={styles.emojiText}>{foodEmoji(food.name)}</Text>
        </View>
        <View style={styles.titleText}>
          <Text numberOfLines={2} style={styles.name}>
            {food.name}
          </Text>
          {food.brand ? <Text style={styles.brand}>{food.brand}</Text> : null}
        </View>
      </View>

      <View style={styles.amountRow}>
        <TextInput
          accessibilityLabel="Cantidad en gramos"
          keyboardType="decimal-pad"
          onChangeText={setText}
          selectTextOnFocus
          style={[styles.amountInput, error !== null && styles.amountInvalid]}
          value={text}
        />
        <Text style={styles.amountUnit}>g</Text>
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}

      <View style={styles.preview}>
        <Text style={styles.kcal}>
          {eaten?.caloriesKcal == null ? '— kcal' : `${Math.round(eaten.caloriesKcal)} kcal`}
        </Text>
        <View style={styles.macros}>
          <MacroTag color={colors.protein} label="P" value={eaten?.proteinGrams ?? null} />
          <MacroTag color={colors.carbohydrates} label="C" value={eaten?.carbohydrateGrams ?? null} />
          <MacroTag color={colors.fat} label="G" value={eaten?.fatGrams ?? null} />
          {eaten?.fiberGrams != null ? (
            <MacroTag color={colors.primaryBright} label="Fibra" value={eaten.fiberGrams} />
          ) : null}
        </View>
      </View>

      <View style={styles.chips}>
        {servings.map((serving) => (
          <Chip
            key={serving.id}
            accessibilityLabel={`${serving.label}, ${serving.grams} gramos`}
            label={`${serving.label} · ${formatGrams(serving.grams)} g`}
            onPress={() => pick(serving.grams)}
            selected={grams === serving.grams}
          />
        ))}
        {QUICK_GRAMS.map((amount) => (
          <Chip
            key={amount}
            accessibilityLabel={`${amount} gramos`}
            label={`${amount} g`}
            onPress={() => pick(amount)}
            selected={grams === amount}
          />
        ))}
      </View>

      <Segmented
        accessibilityLabel="Comida"
        onChange={setMeal}
        options={mealOptions}
        value={meal}
      />

      <View style={styles.buttons}>
        <Button
          disabled={grams === null || saving}
          icon="add-circle-outline"
          title={addedCount > 0 ? `Añadir y seguir (${addedCount})` : 'Añadir y seguir'}
          variant="secondary"
          onPress={() => void submit(true)}
        />
        <Button
          disabled={grams === null}
          loading={saving}
          title={forPlan ? 'Añadir al plan' : 'Añadir al diario'}
          onPress={() => void submit(false)}
        />
      </View>
    </View>
  );
}

function MacroTag({
  color,
  label,
  value,
}: {
  color: string;
  label: string;
  value: number | null;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <View style={styles.tag}>
      <View style={[styles.tagDot, { backgroundColor: color }]} />
      <Text style={styles.tagText}>
        {label} {value === null ? '—' : `${formatGrams(value)} g`}
      </Text>
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    form: {
      gap: spacing.lg,
    },
    titleRow: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: spacing.md,
    },
    emoji: {
      alignItems: 'center',
      backgroundColor: colors.surfaceMuted,
      borderRadius: radius.pill,
      height: 52,
      justifyContent: 'center',
      width: 52,
    },
    emojiText: {
      fontSize: 28,
    },
    titleText: {
      flex: 1,
      gap: 2,
    },
    name: {
      ...typography.title,
      color: colors.text,
      fontSize: 20,
    },
    brand: {
      ...typography.caption,
      color: colors.textMuted,
    },
    amountRow: {
      alignItems: 'baseline',
      flexDirection: 'row',
      gap: spacing.sm,
      justifyContent: 'center',
    },
    amountInput: {
      ...typography.displayLarge,
      ...tabularNumbers,
      backgroundColor: colors.surfaceMuted,
      borderRadius: radius.lg,
      color: colors.text,
      minWidth: 150,
      paddingHorizontal: spacing.xl,
      paddingVertical: spacing.md,
      textAlign: 'center',
    },
    amountInvalid: {
      borderColor: colors.danger,
      borderWidth: 2,
    },
    amountUnit: {
      ...typography.title,
      color: colors.textMuted,
      fontSize: 22,
    },
    error: {
      ...typography.caption,
      color: colors.danger,
      textAlign: 'center',
    },
    preview: {
      alignItems: 'center',
      gap: spacing.sm,
    },
    kcal: {
      ...typography.headline,
      ...tabularNumbers,
      color: colors.primary,
    },
    macros: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.md,
      justifyContent: 'center',
    },
    tag: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: 5,
    },
    tagDot: {
      borderRadius: radius.pill,
      height: 8,
      width: 8,
    },
    tagText: {
      ...typography.caption,
      ...tabularNumbers,
      color: colors.text,
    },
    chips: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.sm,
    },
    buttons: {
      gap: spacing.sm,
    },
  });
}
