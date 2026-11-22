# Cómo generar las APK de JfooD

Esta guía lleva de «el código está listo» a «tengo dos `.apk` instalados en el móvil». Sigue los pasos en orden. Todo lo marcado con 🔑 necesita algo que solo tienes tú (cuentas y claves).

| APK | Qué es | Necesita |
|---|---|---|
| **estable** (`JfooD`) | 100 % sin conexión: diario, catálogo, recordatorios, progreso. Sin cámara ni escáner. | Solo cuenta de Expo |
| **experimental** (`JfooD Experimental`) | Lo mismo + escáner por foto, registro por texto y código de barras. | Cuenta de Expo + la API desplegada en Render + clave de Gemini |

Conviven en el mismo móvil porque tienen `applicationId` distinto (`com.jfood.app` y `com.jfood.app.experimental`). Si solo quieres la estable, salta los pasos 2 y 4.

---

## 1. Comprobar que todo está en verde

Desde la raíz del repositorio:

```sh
npm ci
npm run release:check
```

Ejecuta, y para en el primer fallo: tests (API, móvil, núcleo), `typecheck`, `lint`, compilación de la API y el núcleo, exportación del paquete de Android y `expo-doctor`. Si algo falla, no sigas.

## 2. 🔑 Desplegar la API en Render (solo para la experimental)

1. Sube el repositorio a GitHub.
2. En [Render](https://render.com): **New → Blueprint** y elige el repositorio. Lee `render.yaml` y crea el servicio `jfood-api` (plan gratuito, arranque de producción `node dist/server.js`).
3. En el panel del servicio, **Environment**, escribe los dos valores que `render.yaml` deja vacíos a propósito:
   - `GEMINI_API_KEY`: tu clave de <https://aistudio.google.com/apikey>.
   - `APP_TOKEN`: una cadena larga y aleatoria que inventas tú (por ejemplo, 40 caracteres). **Apúntala**: la necesitas en el paso 4.
4. Espera a que el despliegue termine y comprueba que `https://TU-SERVICIO.onrender.com/health` responde con `"status":"ok"`.
5. Opcional pero recomendable: un monitor gratuito de [UptimeRobot](https://uptimerobot.com) que haga ping a `/health` cada 5 min, para evitar el arranque en frío de ~1 minuto del plan gratuito.

> Prueba local de la misma API en modo producción: `npm run start:api:prod` (con un `apps/api/.env` basado en `apps/api/.env.example`).

## 3. 🔑 Proyecto de Expo (EAS)

```sh
cd apps/mobile
npx eas-cli@latest login        # tu cuenta de expo.dev
npx eas-cli@latest init         # crea el proyecto y muestra su projectId
```

Como la configuración de la app es un script (`app.config.js`), `eas init` no puede escribir el identificador por ti si no lo reconoce: **pégalo a mano** en la constante `EAS_PROJECT_ID` al principio de `apps/mobile/app.config.js`. No es un secreto; puede ir al repositorio.

## 4. 🔑 URL y token de la API (solo para la experimental)

Desde la raíz del repositorio:

```sh
npm run release:set-api-url -- https://TU-SERVICIO.onrender.com
```

Comprueba que es HTTPS y escribe la URL en el perfil `experimental` de `apps/mobile/eas.json` (la build se niega a salir con el valor de ejemplo `TU_API`).

Después, el token (el mismo `APP_TOKEN` de Render). Cada perfil de build usa su propio entorno de EAS (`estable` → `production`, `experimental` → `preview`), así que el token solo llega a la experimental:

```sh
cd apps/mobile
npx eas-cli@latest env:set --name EXPO_PUBLIC_APP_TOKEN --value "EL_MISMO_APP_TOKEN" --environment preview --visibility plaintext
```

El token viaja dentro del APK (cualquiera con el APK puede leerlo), así que solo frena el tráfico casual: lo que de verdad protege tu cupo de Gemini son los límites diarios de la API. Si tu versión de `eas-cli` ofrece `--visibility sensitive`, puedes usarla (`npx eas-cli@latest env:set --help`); **no** uses `secret` con variables `EXPO_PUBLIC_`.

## 5. Compilar

```sh
cd apps/mobile
npx eas-cli@latest build -p android --profile estable
npx eas-cli@latest build -p android --profile experimental
```

- Compila en la nube de EAS (en Windows no se puede compilar Android en local con EAS). Cada build tarda unos 10-20 minutos en la cola gratuita.
- Al terminar, EAS muestra un enlace de descarga del `.apk` de cada una.
- El número de versión interno (`versionCode`) lo gestiona EAS y sube solo en cada build.
- La primera vez te preguntará si quiere generar una *keystore* (la firma de la app): responde que sí y **no la pierdas** (EAS la guarda por ti en tu cuenta).

## 6. Instalar

- **Desde el móvil:** abre el enlace de EAS, descarga el `.apk` y permite «instalar apps de origen desconocido» para el navegador.
- **Desde el PC con `adb`:** `adb install JfooD.apk`.

## 7. Comprobar en el móvil

Esto es lo único que no se puede verificar sin un dispositivo. Pruébalo con la **estable** (y los puntos 8-9 con la experimental):

1. **Primer arranque:** icono y pantalla de inicio nuevos; onboarding de 4 pasos (nombre, datos, avisos, objetivos con confeti). La app debe abrir sin tardar más de unos segundos: copia el catálogo grande la primera vez.
   - **Catálogo grande:** Añadir alimento → busca «yogur natural», «pan de molde», «pechuga de pollo», «hacendado»: salen con marca, calorías y macros sin escribir nada. Elige uno y añádelo al diario; debe aparecer luego en «Recientes». Prueba también la pestaña «Catálogo» (chips de categoría, «Ver más alimentos») y marcar uno como favorito.
   - Si Perfil → Acerca de muestra «El catálogo ampliado no se ha podido cargar», anótalo con el modelo del móvil (la app sigue funcionando con los 338 básicos).
2. **Teclado en las hojas:** Añadir alimento → toca uno → toca el campo de gramos. El botón «Añadir» debe verse entero sobre el teclado, también en un móvil pequeño. Repite con «Otra…» del agua y con tu nombre en Perfil.
3. **Gestos:** en el Diario, desliza una entrada a la izquierda (borra con «Deshacer») y a la derecha (duplica).
4. **Recordatorios:** Perfil → Recordatorios → activa uno con la hora a +2 minutos. Debe llegar la notificación y, al tocarla, abrirse la pantalla correcta. Registra esa comida antes de la hora y comprueba que **no** llega.
5. **Copiar a otro día** (icono de copiar junto a una comida del Diario) y **Duplicar como mío** (ficha de un alimento del catálogo): el original no cambia.
6. **Progreso → Macros** con algunos días registrados; **Agua → Otra…**.
7. **Modo oscuro** (Perfil → Apariencia) y «reducir animaciones» del sistema: sin pantallas rotas ni texto ilegible.
8. **Copia de seguridad:** Perfil → Tus datos → exportar; restaura en la otra APK y comprueba que siguen los recordatorios, el nombre y el catálogo.
9. **Solo experimental:** escáner por foto, por texto («2 huevos y un café») y por código de barras. La primera petición tras un rato puede tardar hasta ~1 minuto (la API gratuita «se duerme»).

### Cosas que son normales

- En Android 12+ los avisos pueden llegar con **unos minutos de retraso**: la app no pide el permiso de «alarmas exactas» a propósito, para no añadir permisos especiales.
- Los recordatorios se programan para los próximos 7 días cada vez que abres la app: si pasas más de una semana sin abrirla, dejarán de llegar hasta que la abras.
- La APK estable no muestra el escáner ni los códigos de barras; es lo esperado.

## 8. Si algo falla

| Síntoma | Qué mirar |
|---|---|
| La build falla con «TU_API» o «HTTPS» | Repite el paso 4 (`release:set-api-url`). |
| `eas build` dice que no hay proyecto | Pega el `projectId` en `EAS_PROJECT_ID` (paso 3). |
| El escáner responde «no autorizada» | El `EXPO_PUBLIC_APP_TOKEN` de EAS no coincide con `APP_TOKEN` de Render; recompila la experimental tras corregirlo. |
| El escáner responde «servicio saturado» | Es el límite de Gemini del nivel gratuito: espera o sube `RECOGNIZE_DAILY_LIMIT` en Render. |
| El botón de la hoja queda tapado por el teclado | Anótalo con el modelo del móvil: el plan B es sustituir el cálculo del teclado por `react-native-keyboard-controller`. |
| No llegan los avisos | Ajustes del móvil → Apps → JfooD → Notificaciones (activadas) y «sin restricciones de batería». Perfil muestra un aviso si el permiso está denegado. |
