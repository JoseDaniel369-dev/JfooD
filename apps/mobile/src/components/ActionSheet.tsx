import { Ionicons } from '@expo/vector-icons';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, radius, spacing, typography } from '@/theme';

export interface ActionSheetOption {
  label: string;
  icon?: keyof typeof Ionicons.glyphMap;
  destructive?: boolean;
  onPress: () => void;
}

interface ActionSheetProps {
  visible: boolean;
  title?: string;
  options: ActionSheetOption[];
  onClose: () => void;
}

export function ActionSheet({ visible, title, options, onClose }: ActionSheetProps) {
  return (
    <Modal
      animationType="slide"
      onRequestClose={onClose}
      transparent
      visible={visible}
    >
      <Pressable
        accessibilityLabel="Cerrar opciones"
        accessibilityRole="button"
        onPress={onClose}
        style={styles.backdrop}
      >
        <View />
      </Pressable>
      <View style={styles.sheet}>
        {title ? <Text style={styles.title}>{title}</Text> : null}
        <View style={styles.options}>
          {options.map((option, index) => {
            const isLast = index === options.length - 1;
            return (
              <Pressable
                key={option.label}
                accessibilityLabel={option.label}
                accessibilityRole="button"
                onPress={() => {
                  onClose();
                  option.onPress();
                }}
                style={[
                  styles.option,
                  !isLast && styles.optionBorder,
                ]}
              >
                {option.icon ? (
                  <Ionicons
                    color={option.destructive ? colors.danger : colors.primary}
                    name={option.icon}
                    size={22}
                  />
                ) : null}
                <Text
                  style={[
                    styles.optionText,
                    option.destructive && styles.destructiveText,
                  ]}
                >
                  {option.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
        <Pressable
          accessibilityLabel="Cancelar"
          accessibilityRole="button"
          onPress={onClose}
          style={({ pressed }) => [styles.cancelButton, pressed && styles.pressed]}
        >
          <Text style={styles.cancelText}>Cancelar</Text>
        </Pressable>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    backgroundColor: colors.overlay,
    flex: 1,
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    gap: spacing.md,
    paddingBottom: spacing.xxxl,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    position: 'absolute',
    width: '100%',
    bottom: 0,
  },
  title: {
    ...typography.caption,
    color: colors.textMuted,
    textAlign: 'center',
  },
  options: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.md,
    overflow: 'hidden',
  },
  option: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    minHeight: 52,
  },
  optionBorder: {
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
  },
  optionText: {
    ...typography.body,
    color: colors.text,
    fontWeight: '600',
  },
  destructiveText: {
    color: colors.danger,
  },
  cancelButton: {
    alignItems: 'center',
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.md,
    justifyContent: 'center',
    minHeight: 52,
    paddingVertical: spacing.md,
  },
  cancelText: {
    ...typography.body,
    color: colors.text,
    fontWeight: '700',
  },
  pressed: {
    opacity: 0.75,
  },
});
