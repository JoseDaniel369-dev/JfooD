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

module.exports = ({ config }) => {
  assertValidApiUrl(process.env.EXPO_PUBLIC_API_URL);
  const experimental = Boolean(process.env.EXPO_PUBLIC_API_URL);

  return {
    ...config,
    name: experimental ? 'JfooD Experimental' : 'JfooD',
    slug: 'jfood',
    version: '0.1.0',
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
    ],
    experiments: {
      typedRoutes: true,
    },
    web: {
      favicon: './assets/favicon.png',
    },
  };
};
