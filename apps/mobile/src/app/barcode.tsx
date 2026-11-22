import { CameraView, useCameraPermissions } from 'expo-camera';
import { router, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useMemo, useRef, useState } from 'react';
import { Linking, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/Button';
import { isScannerEnabled } from '@/config/api';
import {
  createFood,
  findFoodByBarcode,
} from '@/data/sqlite/repositories/foodRepository';
import { hapticSuccess } from '@/features/haptics/haptics';
import { isValidLocalDate, toLocalDate } from '@/features/diary/utils/date';
import { currentDefaultMeal } from '@/features/diary/utils/meals';
import {
  fetchProduct,
  normalizeBarcode,
} from '@/features/foods/utils/openFoodFacts';
import { radius, spacing, typography, useTheme, type ThemeColors } from '@/theme';

type Status =
  | { kind: 'scanning' }
  | { kind: 'looking' }
  | { kind: 'not_found'; barcode: string }
  | { kind: 'error'; message: string };

/** Scans a product barcode, finds or imports the food and opens the amount step. */
export default function BarcodeScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const database = useSQLiteContext();
  const params = useLocalSearchParams<{ date?: string; meal?: string; target?: string }>();
  const [permission, requestPermission] = useCameraPermissions();
  const [status, setStatus] = useState<Status>({ kind: 'scanning' });
  const busy = useRef(false);

  const date = params.date && isValidLocalDate(params.date) ? params.date : toLocalDate(new Date());
  const meal = params.meal ?? currentDefaultMeal();

  const openAmount = (foodId: string) => {
    router.replace({
      pathname: '/diary/add-food',
      params: { date, meal, target: params.target, foodId },
    });
  };

  const handleScanned = async (rawCode: string) => {
    if (busy.current) return;
    const barcode = normalizeBarcode(rawCode);
    if (!barcode) return;

    busy.current = true;
    setStatus({ kind: 'looking' });

    try {
      const local = await findFoodByBarcode(database, barcode);
      if (local) {
        hapticSuccess();
        openAmount(local.id);
        return;
      }

      const product = await fetchProduct(barcode);
      if (!product) {
        setStatus({ kind: 'not_found', barcode });
        busy.current = false;
        return;
      }

      const food = await createFood(database, {
        name: product.name,
        brand: product.brand,
        barcode: product.barcode,
        source: 'open_food_facts',
        externalId: product.barcode,
        ...product.per100g,
      });
      hapticSuccess();
      openAmount(food.id);
    } catch (error) {
      setStatus({
        kind: 'error',
        message:
          error instanceof Error
            ? error.message
            : 'No se ha podido buscar el producto. Comprueba tu conexión.',
      });
      busy.current = false;
    }
  };

  const reset = () => {
    busy.current = false;
    setStatus({ kind: 'scanning' });
  };

  if (!isScannerEnabled()) {
    return (
      <View style={[styles.screen, styles.centered]}>
        <Text style={styles.title}>No disponible en esta versión</Text>
        <Text style={styles.text}>
          El lector de códigos de barras necesita conexión y solo está en la versión experimental.
        </Text>
        <Button title="Volver" onPress={() => router.back()} />
      </View>
    );
  }

  if (!permission) {
    return <View style={styles.screen} />;
  }

  if (!permission.granted) {
    return (
      <View style={[styles.screen, styles.centered]}>
        <Text style={styles.title}>Permiso de cámara</Text>
        <Text style={styles.text}>
          Necesitamos la cámara para leer el código de barras. La imagen no se
          guarda ni se envía: solo se lee el número.
        </Text>
        {permission.canAskAgain ? (
          <Button title="Permitir cámara" onPress={() => void requestPermission()} />
        ) : (
          <>
            <Text style={styles.text}>
              Has bloqueado el permiso: actívalo en los ajustes de la app para poder escanear.
            </Text>
            <Button title="Abrir ajustes" onPress={() => void Linking.openSettings()} />
          </>
        )}
        <Button title="Volver" variant="secondary" onPress={() => router.back()} />
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <CameraView
        barcodeScannerSettings={{ barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e'] }}
        facing="back"
        onBarcodeScanned={
          status.kind === 'scanning'
            ? (result) => void handleScanned(result.data)
            : undefined
        }
        style={styles.camera}
      />
      <View pointerEvents="none" style={styles.frameWrap}>
        <View style={styles.frame} />
      </View>

      <View style={styles.panel}>
        {status.kind === 'scanning' ? (
          <Text style={styles.text}>Apunta al código de barras del envase.</Text>
        ) : null}
        {status.kind === 'looking' ? (
          <Text style={styles.text}>Buscando el producto…</Text>
        ) : null}
        {status.kind === 'not_found' ? (
          <>
            <Text style={styles.title}>Producto no encontrado</Text>
            <Text style={styles.text}>
              El código {status.barcode} no está en Open Food Facts. Puedes
              crear el alimento a mano.
            </Text>
            <Button
              title="Crear alimento"
              onPress={() =>
                router.replace({
                  pathname: '/diary/add-food',
                  params: {
                    date,
                    meal,
                    target: params.target,
                    create: '1',
                    barcode: status.barcode,
                  },
                })
              }
            />
            <Button title="Escanear otro" variant="secondary" onPress={reset} />
          </>
        ) : null}
        {status.kind === 'error' ? (
          <>
            <Text style={styles.title}>No se ha podido buscar</Text>
            <Text style={styles.text}>{status.message}</Text>
            <Button title="Reintentar" onPress={reset} />
          </>
        ) : null}
        <Text style={styles.attribution}>
          Datos de productos: Open Food Facts (licencia ODbL).
        </Text>
      </View>
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    screen: { backgroundColor: colors.background, flex: 1 },
    centered: { gap: spacing.lg, justifyContent: 'center', padding: spacing.xl },
    camera: { flex: 1 },
    frameWrap: {
      alignItems: 'center',
      bottom: 0,
      justifyContent: 'center',
      left: 0,
      position: 'absolute',
      right: 0,
      top: 0,
    },
    frame: {
      borderColor: '#FFFFFF',
      borderRadius: radius.lg,
      borderWidth: 3,
      height: 150,
      width: '78%',
    },
    panel: {
      backgroundColor: colors.surface,
      borderTopLeftRadius: radius.lg,
      borderTopRightRadius: radius.lg,
      gap: spacing.md,
      padding: spacing.xl,
    },
    title: { ...typography.title, color: colors.text },
    text: { ...typography.body, color: colors.text },
    attribution: { ...typography.caption, color: colors.textMuted },
  });
}
