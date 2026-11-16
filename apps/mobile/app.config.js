module.exports = ({ config }) => {
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
          cameraPermission: 'JfooD necesita acceso a la cámara para fotografiar tu comida.',
          photosPermission: 'JfooD necesita acceso a tus fotos para elegir imágenes de comida.',
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
