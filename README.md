# Asymettry

Registro de entrenamientos por microciclos que guarda cada serie en tu propio Excel de Google Drive.

- Login con Google y permiso mínimo (`drive.file`): solo accede a los Excel que eliges o que crea la app.
- Sin base de datos: los datos viven en el Excel y la sesión en una cookie cifrada.
- Solo se modifican las celdas de registro, por lo que se conserva el formato del Excel.

Formato en la columna `KGs x Reps`: `82.5x7 / 70x11`, `60x8+DS45x6+P4`, `60x8+RP3`, `1min`. Un `-` indica una serie sin hacer.

## Configurar Google Cloud

En [Google Cloud Console](https://console.cloud.google.com/):

1. Crea un proyecto y anota el **número de proyecto** (en *Panel*).
2. En *APIs y servicios > Biblioteca*, habilita **Google Drive API** y **Google Picker API**.
3. En *Google Auth Platform > Marca*, indica el nombre de la app, tu correo, y las URL de la página principal, de `/privacidad` (política de privacidad) y de `/terminos` (condiciones del servicio).
4. En *Público*, elige **Externo** y pulsa **Publicar app** para pasarla a producción. En modo de prueba solo entran las cuentas dadas de alta.
5. En *Acceso a datos*, añade solo `openid`, `email`, `profile` y `.../auth/drive.file`.
6. En *Clientes*, crea un cliente **Aplicación web** con:
   - Orígenes de JavaScript: `http://localhost:3000` y tu URL de Vercel.
   - URI de redirección: `http://localhost:3000/api/auth/callback` y `https://TU-APP.vercel.app/api/auth/callback`.
7. En *Credenciales*, crea una **clave de API** y restríngela a Google Picker API y a tus dominios (`http://localhost:3000/*` y `https://TU-APP.vercel.app/*`).

## Ejecutar en local

```bash
cp .env.example .env.local   # rellénalo; SESSION_SECRET se genera con: openssl rand -base64 48
npm install
npm run dev                  # http://localhost:3000
```

## Publicar en Vercel

1. Sube el repositorio a GitHub e impórtalo en [Vercel](https://vercel.com/new).
2. Añade las variables de `.env.example`, con `APP_URL=https://TU-APP.vercel.app` (sin barra final).
3. Comprueba que esa URL está en el cliente OAuth y en la clave de API.
4. Prueba con una cuenta distinta a la tuya, en una ventana de incógnito.

## Pruebas

```bash
npm test            # lectura y escritura de Excel, pautas y formato de registro
npm run typecheck
```

`tests/fake-google.mjs` imita a Google y Drive para probar el flujo sin credenciales. Se activa con `GOOGLE_FAKE_BASE`, que se ignora en producción.

`npm run templates` regenera `templates/` a partir de los Excel originales, con los registros vacíos.
