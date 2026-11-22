const LOCAL_HTTP = /^http:\/\/(localhost|127\.0\.0\.1|10\.|192\.168\.)/i;

/** Fails the build early instead of shipping an APK whose scanner cannot work. */
function assertValidApiUrl(url) {
  if (!url) return;
  if (/TU_API/i.test(url)) {
    throw new Error(
      'EXPO_PUBLIC_API_URL sigue con el valor de ejemplo (TU_API). ' +
        'Edita apps/mobile/eas.json con la URL real de tu API.',
    );
  }
  if (!/^https:\/\//i.test(url) && !LOCAL_HTTP.test(url)) {
    throw new Error('EXPO_PUBLIC_API_URL debe ser una URL HTTPS pública.');
  }
}

/**
 * Id of the Expo (EAS) project. `eas init` creates the project and prints this id;
 * because this config is a script, it cannot be written for you: paste it here.
 * It is an identifier, not a secret, so it can live in git.
 */
const EAS_PROJECT_ID = '';

module.exports = ({ config }) => {
  assertValidApiUrl(process.env.EXPO_PUBLIC_API_URL);
  // A development build (eas.json "development" profile) also has the scanner: it
  // is enabled in __DEV__ even without an API URL, so the camera must be declared.
  const experimental =
    Boolean(process.env.EXPO_PUBLIC_API_URL) || process.env.APP_VARIANT === 'development';

  return {
    ...config,
    name: experimental ? 'JfooD Experimental' : 'JfooD',
    slug: 'jfood',
    version: '0.2.0',
    orientation: 'portrait',
    scheme: 'jfood',
    icon: './assets/icon.png',
    userInterfaceStyle: 'automatic',
    backgroundColor: '#F3F8F4',
    ios: {
      supportsTablet: true,
      bundleIdentifier: experimental ? 'com.jfood.app.experimental' : 'com.jfood.app',
    },
    android: {
      package: experimental ? 'com.jfood.app.experimental' : 'com.jfood.app',
      adaptiveIcon: {
        backgroundColor: '#F6F7F2',
        foregroundImage: './assets/android-icon-foreground.png',
        backgroundImage: './assets/android-icon-background.png',
        monochromeImage: './assets/android-icon-monochrome.png',
      },
      predictiveBackGestureEnabled: false,
      // Permissions that libraries add to the manifest but this app never uses.
      // The offline build has no scanner, so it also drops the camera that
      // expo-camera adds regardless of its plugin options.
      blockedPermissions: [
        'android.permission.RECORD_AUDIO',
        'android.permission.SYSTEM_ALERT_WINDOW',
        ...(experimental ? [] : ['android.permission.CAMERA']),
      ],
    },
    plugins: [
      'expo-router',
      'expo-sqlite',
      [
        'expo-navigation-bar',
        {
          style: 'dark',
        },
      ],
      [
        'expo-image-picker',
        {
          // Only the experimental build has the scanner. The offline build
          // declares no camera/photo permissions; neither build needs the
          // microphone (the app never records video).
          cameraPermission: experimental
            ? 'JfooD necesita acceso a la cámara para fotografiar tu comida.'
            : false,
          photosPermission: experimental
            ? 'JfooD necesita acceso a tus fotos para elegir imágenes de comida.'
            : false,
          microphonePermission: false,
        },
      ],
      [
        'expo-camera',
        {
          // Barcode scanning needs the network (Open Food Facts), so only the
          // experimental build declares the camera; nobody needs the microphone.
          cameraPermission: experimental
            ? 'JfooD necesita la cámara para leer el código de barras de los productos.'
            : false,
          microphonePermission: false,
          recordAudioAndroid: false,
        },
      ],
      '@react-native-community/datetimepicker',
      'expo-status-bar',
      'expo-font',
      [
        'expo-splash-screen',
        {
          image: './assets/splash-icon.png',
          imageWidth: 200,
          resizeMode: 'contain',
          backgroundColor: '#F7F8F2',
          dark: {
            image: './assets/splash-icon-dark.png',
            backgroundColor: '#0A1411',
          },
        },
      ],
      [
        'expo-notifications',
        {
          // 96x96 all-white icon: Android draws it in the status bar.
          icon: './assets/notification-icon.png',
          color: '#059669',
          defaultChannel: 'recordatorios',
        },
      ],
    ],
    ...(EAS_PROJECT_ID
      ? { extra: { ...config.extra, eas: { projectId: EAS_PROJECT_ID } } }
      : {}),
    experiments: {
      typedRoutes: true,
    },
    web: {
      favicon: './assets/favicon.png',
    },
  };
};
