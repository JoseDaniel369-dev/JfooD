import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, Linking, Platform, Pressable, StyleSheet, Switch, Text, View } from 'react-native';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Chip } from '@/components/Chip';
import { SectionHeader } from '@/components/SectionHeader';
import { useToast } from '@/components/Toast';
import { hapticSelection } from '@/features/haptics/haptics';
import { radius, spacing, typography, useTheme, type ThemeColors } from '@/theme';

import {
  getReminderPermission,
  loadReminderSettings,
  requestReminderPermission,
  saveReminderSettings,
  scheduleReminders,
  type ReminderPermission,
} from './notifications';
import {
  formatTime,
  isValidWaterWindow,
  toMinutes,
  type ReminderSettings,
  type TimeOfDay,
  type Weekday,
} from './settings';

type MealKey = 'breakfast' | 'lunch' | 'dinner';
type WeeklyKey = 'weigh' | 'weeklySummary';

/** What the open time picker edits. */
type PickerTarget = { kind: MealKey | WeeklyKey } | { kind: 'waterFrom' } | { kind: 'waterTo' };

const MEAL_ROWS: { key: MealKey; emoji: string; label: string }[] = [
  { key: 'breakfast', emoji: '🍳', label: 'Desayuno' },
  { key: 'lunch', emoji: '🥗', label: 'Comida' },
  { key: 'dinner', emoji: '🍝', label: 'Cena' },
];

const WEEKDAYS: { value: Weekday; short: string; full: string }[] = [
  { value: 1, short: 'Lun', full: 'lunes' },
  { value: 2, short: 'Mar', full: 'martes' },
  { value: 3, short: 'Mié', full: 'miércoles' },
  { value: 4, short: 'Jue', full: 'jueves' },
  { value: 5, short: 'Vie', full: 'viernes' },
  { value: 6, short: 'Sáb', full: 'sábado' },
  { value: 7, short: 'Dom', full: 'domingo' },
];

function timeToDate(time: TimeOfDay): Date {
  const minutes = toMinutes(time);
  const date = new Date();
  date.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0);
  return date;
}

function timeOf(settings: ReminderSettings, target: PickerTarget): TimeOfDay {
  switch (target.kind) {
    case 'waterFrom':
      return settings.water.from;
    case 'waterTo':
      return settings.water.to;
    case 'breakfast':
    case 'lunch':
    case 'dinner':
      return settings[target.kind].time;
    case 'weigh':
    case 'weeklySummary':
      return settings[target.kind].time;
  }
}

/** Profile section to turn the local reminders on and choose their times. */
export function RemindersCard() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const database = useSQLiteContext();
  const { showToast } = useToast();

  const [settings, setSettings] = useState<ReminderSettings | null>(null);
  const [permission, setPermission] = useState<ReminderPermission>('undetermined');
  const [picker, setPicker] = useState<PickerTarget | null>(null);
  /** iOS spinner: the time being scrolled to; applied only when "Listo" is pressed. */
  const [pickerDraft, setPickerDraft] = useState<Date | null>(null);
  /**
   * Always the latest settings. `change` can wait on the system permission
   * dialog for a long time: it must not apply its edit to a stale snapshot and
   * overwrite what was changed meanwhile.
   */
  const settingsRef = useRef<ReminderSettings | null>(null);

  // Also runs when coming back from the system settings with the permission changed.
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      void (async () => {
        try {
          const [stored, granted] = await Promise.all([
            loadReminderSettings(database),
            getReminderPermission(),
          ]);
          if (cancelled) return;
          settingsRef.current = stored;
          setSettings(stored);
          setPermission(granted);
          // A permission granted meanwhile (from the system settings) takes effect now.
          void scheduleReminders(database);
        } catch {
          // The card stays hidden; reminders are optional.
        }
      })();
      return () => {
        cancelled = true;
      };
    }, [database]),
  );

  // The person may grant or revoke the permission in the system settings and come back.
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        void getReminderPermission().then(setPermission);
      }
    });
    return () => subscription.remove();
  }, []);

  const commit = async (next: ReminderSettings, previous: ReminderSettings) => {
    settingsRef.current = next;
    setSettings(next);
    try {
      await saveReminderSettings(database, next);
      void scheduleReminders(database);
    } catch {
      settingsRef.current = previous;
      setSettings(previous);
      showToast('No se han podido guardar los recordatorios.', 'error');
    }
  };

  if (!settings) {
    return null;
  }

  /** Applies a change; turning the first reminder on asks for the permission. */
  const change = async (apply: (current: ReminderSettings) => ReminderSettings, enabling = false) => {
    if (enabling && permission !== 'granted') {
      const granted = await requestReminderPermission();
      setPermission(granted ? 'granted' : 'denied');
      if (!granted) {
        showToast('Activa las notificaciones de JfooD en los ajustes del móvil.', 'error');
        return;
      }
    }
    const base = settingsRef.current ?? settings;
    await commit(apply(base), base);
  };

  const openPicker = (target: PickerTarget) => {
    setPickerDraft(null);
    setPicker(target);
  };

  const toggleMeal = (key: MealKey, enabled: boolean) =>
    change((current) => ({ ...current, [key]: { ...current[key], enabled } }), enabled);

  const toggleWeekly = (key: WeeklyKey, enabled: boolean) =>
    change((current) => ({ ...current, [key]: { ...current[key], enabled } }), enabled);

  const setWeekday = (key: WeeklyKey, weekday: Weekday) =>
    change((current) => ({ ...current, [key]: { ...current[key], weekday } }));

  /** Saves the chosen time into the reminder the picker was opened for. */
  const applyTime = (target: PickerTarget, selected: Date) => {
    const current = settingsRef.current ?? settings;
    const time = formatTime(selected.getHours(), selected.getMinutes());
    if (target.kind === 'waterFrom' || target.kind === 'waterTo') {
      const from = target.kind === 'waterFrom' ? time : current.water.from;
      const to = target.kind === 'waterTo' ? time : current.water.to;
      if (!isValidWaterWindow(from, to)) {
        showToast('La hora de inicio debe ser anterior a la de fin.', 'error');
        return;
      }
      void change((latest) => ({ ...latest, water: { ...latest.water, from, to } }));
      return;
    }
    const key = target.kind;
    void change((latest) => ({ ...latest, [key]: { ...latest[key], time } }));
  };

  const handlePick = (event: DateTimePickerEvent, selected?: Date) => {
    if (Platform.OS === 'android') {
      // The Android dialog reports once; a dismissed one must not save anything.
      const target = picker;
      setPicker(null);
      if (target && selected && event.type === 'set') applyTime(target, selected);
      return;
    }
    // The iOS spinner reports on every tick: wait for "Listo" before saving anything.
    if (selected) setPickerDraft(selected);
  };

  const closeIosPicker = () => {
    if (picker && pickerDraft) applyTime(picker, pickerDraft);
    setPicker(null);
    setPickerDraft(null);
  };

  const setEvery = (delta: number) => {
    const everyHours = Math.min(6, Math.max(1, settings.water.everyHours + delta));
    if (everyHours === settings.water.everyHours) return;
    hapticSelection();
    void change((current) => ({ ...current, water: { ...current.water, everyHours } }));
  };

  // Shown whenever the system refuses notifications, so the way to fix it is always at hand.
  const showDeniedNotice = permission === 'denied';

  return (
    <Card>
      <SectionHeader title="Recordatorios" />
      <Text style={styles.hint}>
        Avisos en tu móvil, sin conexión. Si ya has registrado la comida, no te avisamos.
      </Text>

      {showDeniedNotice ? (
        <View style={styles.notice}>
          <Text style={styles.noticeText}>
            Las notificaciones están desactivadas para JfooD, así que los avisos no llegarán.
          </Text>
          <Button
            icon="settings-outline"
            size="small"
            title="Abrir ajustes"
            variant="secondary"
            onPress={() => void Linking.openSettings()}
          />
        </View>
      ) : null}

      {MEAL_ROWS.map(({ key, emoji, label }) => (
        <ReminderRow
          key={key}
          emoji={emoji}
          enabled={settings[key].enabled}
          label={label}
          onToggle={(value) => void toggleMeal(key, value)}
        >
          <TimeButton
            label={`Hora del recordatorio de ${label.toLowerCase()}`}
            onPress={() => openPicker({ kind: key })}
            time={settings[key].time}
          />
        </ReminderRow>
      ))}

      <ReminderRow
        emoji="💧"
        enabled={settings.water.enabled}
        label="Agua"
        onToggle={(value) =>
          void change((current) => ({ ...current, water: { ...current.water, enabled: value } }), value)
        }
      >
        <View style={styles.waterWindow}>
          <Text style={styles.small}>De</Text>
          <TimeButton
            label="Primera hora del recordatorio de agua"
            onPress={() => openPicker({ kind: 'waterFrom' })}
            time={settings.water.from}
          />
          <Text style={styles.small}>a</Text>
          <TimeButton
            label="Última hora del recordatorio de agua"
            onPress={() => openPicker({ kind: 'waterTo' })}
            time={settings.water.to}
          />
        </View>
        <View style={styles.stepperRow}>
          <Text style={styles.small}>Cada</Text>
          <Pressable
            accessibilityLabel="Menos frecuente"
            accessibilityRole="button"
            disabled={settings.water.everyHours <= 1}
            onPress={() => setEvery(-1)}
            style={[styles.stepper, settings.water.everyHours <= 1 && styles.disabled]}
          >
            <Text style={styles.stepperText}>−</Text>
          </Pressable>
          <Text style={styles.everyValue}>{settings.water.everyHours} h</Text>
          <Pressable
            accessibilityLabel="Más frecuente"
            accessibilityRole="button"
            disabled={settings.water.everyHours >= 6}
            onPress={() => setEvery(1)}
            style={[styles.stepper, settings.water.everyHours >= 6 && styles.disabled]}
          >
            <Text style={styles.stepperText}>+</Text>
          </Pressable>
        </View>
      </ReminderRow>

      <WeeklyRow
        emoji="⚖️"
        label="Pesarte"
        timeLabel="Hora del recordatorio de pesarte"
        onPickTime={() => openPicker({ kind: 'weigh' })}
        onToggle={(value) => void toggleWeekly('weigh', value)}
        onWeekday={(weekday) => void setWeekday('weigh', weekday)}
        value={settings.weigh}
      />
      <WeeklyRow
        emoji="📊"
        label="Resumen semanal"
        timeLabel="Hora del recordatorio del resumen semanal"
        onPickTime={() => openPicker({ kind: 'weeklySummary' })}
        onToggle={(value) => void toggleWeekly('weeklySummary', value)}
        onWeekday={(weekday) => void setWeekday('weeklySummary', weekday)}
        value={settings.weeklySummary}
      />

      {picker ? (
        <>
          <DateTimePicker
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            is24Hour
            mode="time"
            onChange={handlePick}
            value={pickerDraft ?? timeToDate(timeOf(settings, picker))}
          />
          {Platform.OS === 'ios' ? (
            <Button size="small" title="Listo" variant="secondary" onPress={closeIosPicker} />
          ) : null}
        </>
      ) : null}
    </Card>
  );
}

function ReminderRow({
  emoji,
  label,
  enabled,
  onToggle,
  children,
}: {
  emoji: string;
  label: string;
  enabled: boolean;
  onToggle: (value: boolean) => void;
  children?: React.ReactNode;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <View style={styles.row}>
      <View style={styles.rowHeader}>
        <Text style={styles.emoji}>{emoji}</Text>
        <Text style={styles.rowLabel}>{label}</Text>
        <Switch
          accessibilityLabel={`Recordatorio: ${label}`}
          onValueChange={onToggle}
          thumbColor={enabled ? colors.primary : colors.surface}
          trackColor={{ false: colors.border, true: colors.primaryLight }}
          value={enabled}
        />
      </View>
      {enabled ? <View style={styles.rowBody}>{children}</View> : null}
    </View>
  );
}

function WeeklyRow({
  emoji,
  label,
  timeLabel,
  value,
  onToggle,
  onWeekday,
  onPickTime,
}: {
  emoji: string;
  label: string;
  timeLabel: string;
  value: { enabled: boolean; weekday: Weekday; time: TimeOfDay };
  onToggle: (value: boolean) => void;
  onWeekday: (weekday: Weekday) => void;
  onPickTime: () => void;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <ReminderRow emoji={emoji} enabled={value.enabled} label={label} onToggle={onToggle}>
      <View style={styles.weekdays}>
        {WEEKDAYS.map((day) => (
          <Chip
            key={day.value}
            accessibilityLabel={day.full}
            label={day.short}
            onPress={() => onWeekday(day.value)}
            selected={value.weekday === day.value}
          />
        ))}
      </View>
      <TimeButton label={timeLabel} onPress={onPickTime} time={value.time} />
    </ReminderRow>
  );
}

function TimeButton({ time, label, onPress }: { time: TimeOfDay; label: string; onPress: () => void }) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <Pressable
      accessibilityLabel={`${label}: ${time}`}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.timeButton, pressed && styles.pressed]}
    >
      <Text style={styles.timeText}>{time}</Text>
    </Pressable>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    hint: {
      ...typography.caption,
      color: colors.textMuted,
    },
    notice: {
      backgroundColor: colors.dangerLight,
      borderRadius: radius.md,
      gap: spacing.sm,
      padding: spacing.md,
    },
    noticeText: {
      ...typography.caption,
      color: colors.danger,
    },
    row: {
      borderTopColor: colors.border,
      borderTopWidth: StyleSheet.hairlineWidth,
      gap: spacing.sm,
      paddingTop: spacing.md,
    },
    rowHeader: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: spacing.md,
      minHeight: 48,
    },
    emoji: {
      fontSize: 22,
    },
    rowLabel: {
      ...typography.body,
      color: colors.text,
      flex: 1,
      fontWeight: '700',
    },
    rowBody: {
      alignItems: 'flex-start',
      gap: spacing.sm,
      paddingLeft: spacing.xxxl,
    },
    waterWindow: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: spacing.sm,
    },
    stepperRow: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: spacing.md,
    },
    stepper: {
      alignItems: 'center',
      backgroundColor: colors.surfaceMuted,
      borderColor: colors.border,
      borderRadius: radius.pill,
      borderWidth: 1,
      height: 44,
      justifyContent: 'center',
      width: 44,
    },
    stepperText: {
      ...typography.title,
      color: colors.text,
    },
    everyValue: {
      ...typography.body,
      color: colors.text,
      fontWeight: '700',
      minWidth: 36,
      textAlign: 'center',
    },
    disabled: {
      opacity: 0.4,
    },
    small: {
      ...typography.caption,
      color: colors.textMuted,
    },
    weekdays: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.sm,
    },
    timeButton: {
      alignItems: 'center',
      backgroundColor: colors.surfaceMuted,
      borderColor: colors.border,
      borderRadius: radius.md,
      borderWidth: 1,
      justifyContent: 'center',
      minHeight: 44,
      minWidth: 76,
      paddingHorizontal: spacing.md,
    },
    timeText: {
      ...typography.body,
      color: colors.text,
      fontVariant: ['tabular-nums'],
      fontWeight: '700',
    },
    pressed: {
      opacity: 0.8,
    },
  });
}
