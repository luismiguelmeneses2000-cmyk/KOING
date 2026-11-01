# KOING

PWA de finanzas personales y de emprendimiento/negocio: ingresos, gastos en **dólares y bolívares** (tasa BCV automática), deudas a crédito, lo que deberás por quincena, metas con avisos antes de gastar, y para el negocio: ventas, proveedores, picos de venta y productos estrella.

**Stack:** HTML + JavaScript sin compilación · funciones serverless de Vercel (`/api`) · MongoDB Atlas · JWT.
No necesitas instalar nada en tu computadora: todo se sube desde la web de GitHub y Vercel lo publica.

---

## Cómo publicarla (paso a paso)

### 1. MongoDB Atlas
1. Entra a <https://cloud.mongodb.com> y crea un cluster (el gratuito M0 sirve).
2. **Database Access** → *Add New Database User*: usuario y clave (guárdalos).
3. **Network Access** → *Add IP Address* → `0.0.0.0/0` (Vercel usa IPs variables).
4. **Connect** → *Drivers* → copia la cadena `mongodb+srv://...` y reemplaza `<password>` por tu clave.

> La base de datos `koing` y sus colecciones se crean solas la primera vez que alguien se registra.

### 2. GitHub
1. Crea un repositorio nuevo (por ejemplo `koing`), privado.
2. *Add file → Upload files* y arrastra **todo el contenido** de esta carpeta (no la carpeta en sí: `index.html` debe quedar en la raíz del repo).
3. *Commit changes*.

### 3. Vercel
1. *Add New → Project* → importa el repo `koing`.
2. Framework Preset: **Other**. No cambies Build Command ni Output Directory.
3. En **Environment Variables** agrega:

| Nombre | Valor |
|---|---|
| `MONGODB_URI` | la cadena de Atlas del paso 1 |
| `MONGODB_DB` | `koing` |
| `JWT_SECRET` | una frase larga y secreta (ej. 40 letras al azar) |
| `GMAIL_USER` | el Gmail desde el que salen los correos de "Olvidé mi clave" |
| `GMAIL_APP_PASSWORD` | la **contraseña de aplicación** de ese Gmail (16 letras, ver abajo) |
| `APP_URL` | la dirección de tu app, ej. `https://koing-seven.vercel.app` |

**Contraseña de aplicación de Gmail** (para "Olvidé mi clave"):
1. Entra a <https://myaccount.google.com/security> y activa la **Verificación en 2 pasos** si no la tienes.
2. Entra a <https://myaccount.google.com/apppasswords>, escribe `KOING` y toca **Crear**.
3. Copia las 16 letras que salen: ese es `GMAIL_APP_PASSWORD`. No es tu clave normal de Gmail.

Sin esas variables la app funciona igual; solo "Olvidé mi clave" responde que no pudo enviar el correo.

4. *Deploy*. Al terminar, abre la URL desde el teléfono.

### 4. Instalarla en el teléfono

Al abrir el link desde un teléfono, KOING muestra primero una pantalla para instalarla:
- **Android (Chrome, Edge, Samsung):** botón **Instalar KOING**, un toque y queda como app. Si el navegador no ofrece el botón, se muestran los pasos del menú.
- **iPhone:** Apple no permite instalar con un botón; se muestran los 3 toques de Safari (Compartir → Agregar a inicio → Agregar).
- **Si el link se abre dentro de WhatsApp, Instagram o Facebook:** esos navegadores no pueden instalar; en Android aparece **Abrir en Chrome** y en iPhone los pasos para abrir en Safari.
- Cuando ya está instalada (se abre desde el ícono), esta pantalla no vuelve a salir.

Al abrir la app: el cerdito recibe 3 monedas, se sacude, y la cámara entra por la ranura hacia tu pantalla de inicio; los montos cuentan desde cero.

Instrucciones manuales, por si acaso:
- **Android (Chrome):** menú ⋮ → *Instalar app* / *Agregar a pantalla principal*.
- **iPhone (Safari):** botón Compartir → *Agregar a inicio*.

---

## Qué hace

| Pantalla | Qué tiene |
|---|---|
| Presentación | El cerdito entra rebotando y explica la app en 4 pasos. |
| Crear cuenta / Entrar | Correo y clave. Los datos quedan en tu cuenta (ves lo mismo en cualquier teléfono). |
| 7 preguntas | Nombre y moneda · cada cuánto cobras · cuánto · deudas · gastos fijos · metas · cuánto apartar. Así la app arranca armada y no tienes que cargar todo a mano. |
| Inicio | Disponible para gastar y un menú corto: Cómo va tu quincena, Próximos pagos, Tu meta y Movimientos. Cada opción abre su detalle. |
| Caja de ahorro | Reto de $500, $1.000, $1.500 o $5.000: una cuadrícula de números en dólares que suman exacto la meta. Tachas cada número cuando guardas esa cantidad y el cerdito celebra con confeti. |
| Pagar una deuda | Cuota completa o **abono parcial**: el abono se acumula hasta completar la cuota; si pagas de más, adelanta cuotas. |
| Botón **+** | Gasto, pago de deuda, ingreso extra, deuda nueva o meta. |
| Gasto | Si es **A crédito**, crea la deuda sola con sus cuotas. Antes de guardar revisa si el gasto pone en riesgo tu meta #1 o tu presupuesto y te avisa (“Si gastas esto, no podrás comprar…”). |
| Deudas | Agrupadas por tipo (cuotas, tarjeta, préstamo, otra): cuota, frecuencia, hasta cuándo y cuántas llevas. |
| Lo que deberé por quincena | Tabla de los próximos 6 periodos: cuánto debes y cuánto te queda. Exporta a Excel. |
| Metas | “Lo que necesito” y “Lo que quiero”, por prioridad (subir/bajar), apartar dinero, fecha estimada, marcar como comprada. |
| Movimientos | Por periodo, con flechas para ver periodos anteriores. Exporta a Excel (CSV). |
| Ajustes | Cobro, sueldo ($ o Bs), gastos fijos, cuánto apartar, activar emprendimiento/negocio, invitar a un amigo, cerrar sesión, borrar cuenta. |
| Olvidé mi clave | Manda un enlace al correo (vence en 30 min) para crear una clave nueva. |

### Dólares y bolívares
- Arriba en Inicio está la **tasa BCV del día** (se trae sola de DolarAPI y se guarda; si la fuente falla se usa la última conocida). Con **Cambiar** pones otra tasa para hoy.
- Cada gasto, ingreso, pago o venta se anota en **$ o Bs** y guarda la tasa de ese día. Todo se suma en $ y se muestra también en Bs.
- Tu sueldo puede ser en Bs: se convierte con la tasa del día.
- Inicio separa cuánto gastaste en $ y cuánto en Bs. El botón **$ / Bs** cambia el monto grande.

### Emprendimiento o negocio
Se elige en la primera pregunta (o en Ajustes si ya tienes cuenta). Aparece un selector arriba: **Personal | Nombre de tu negocio**.

| Pantalla | Qué tiene |
|---|---|
| Inicio | Vendido hoy, cobrado en $ y en Bs, gastos del día, cuánto te queda, últimos 7 días con el pico, deuda con proveedores. |
| Ventas | Ventas por día con hora y forma de cobro (efectivo, pago móvil, punto, Zelle), y las salidas del día. |
| Proveedores | A qué empresa le debes, en qué moneda, cuándo vence. Pagos completos o abonos. |
| Reportes | 7 días / mes / año: vendiste, gastaste, ganaste; cómo te pagaron ($ vs Bs); mejor día, mejor hora y día flojo; productos estrella. Exporta a Excel. |
| Pasar ganancia a lo personal | Sale del negocio y entra como ingreso en lo personal ("De Tortas de Mamá Luisa +$120"). |

Los productos estrella se agrupan por cómo escribes la venta; al anotar, la app sugiere lo que ya vendiste para que se escriba igual.

**Cómo calcula el disponible:**
`ingreso del periodo + ingresos extra − cuotas que vencen en el periodo (pagadas o no) − gastos fijos del mes repartidos − gastos (sin contar los hechos a crédito) − lo que apartas para metas`.

- El sueldo se suma solo cada periodo: solo anotas ingresos **extra**.
- Una compra a crédito no resta completa: resta su cuota en cada periodo.
- Las cuotas atrasadas se cuentan en el periodo actual.
- Si borras un pago, la cuota vuelve a quedar pendiente; si borras un gasto a crédito, se borra la deuda que creó.

**Animaciones:** cambio de pestaña con deslizamiento hacia el lado elegido, pantallas que entran desde la derecha, hojas que suben desde abajo, filas que aparecen en cascada y el cerdito que recibe la moneda al registrar un pago, un ingreso o un apartado. Si el teléfono tiene activado “reducir movimiento”, todo pasa a un fundido simple.

**Modo oscuro:** sigue el ajuste del teléfono. En modo claro el fondo es blanco.

---

## Estructura

```
index.html               Página única de la app
manifest.webmanifest     Datos para instalarla como app
sw.js                    Service worker (abre sin internet con lo último que viste)
css/app.css              Estilos, colores y animaciones
js/app.js                Pantallas y navegación
js/calc.js               Cálculos: periodos, cuotas, disponible, proyección, alertas
js/pig.js                El cerdito en SVG + íconos
js/api.js                Llamadas al servidor con el token
js/instalar.js           Pantalla para instalar la app (Android, iPhone, WhatsApp)
api/auth.js              Registro e inicio de sesión
api/perfil.js            Perfil + carga de todos los datos + borrar cuenta
api/items.js             Movimientos, deudas, metas, ventas y proveedores (crear, editar, borrar, pagar, abonar, pasar ganancia)
api/tasa.js              Tasa BCV del día (con caché en Mongo)
lib/db.js                Conexión a MongoDB (reutilizada entre llamadas)
lib/auth.js              JWT
lib/util.js              Limpieza de datos y fechas
icons/                   Íconos de la app y capturas que muestra Android al instalar
```

Son **4 funciones serverless** (Vercel Hobby permite hasta 12). El código compartido va en `/lib`, que no cuenta como función.

### Colecciones en MongoDB

| Colección | Campos principales |
|---|---|
| `users` | `email` (único), `nombre`, `passHash`, `createdAt` |
| `perfiles` | `userId`, `nombre`, `frecuencia`, `ingreso`, `moneda`, `fijos[]`, `apartar`, `avisos`, `onboarded` |
| `movimientos` | `userId`, `tipo` (gasto/ingreso/pago/ahorro), `monto`, `descripcion`, `categoria`, `metodo`, `fecha` (AAAA-MM-DD), `deudaId`, `metaId` |
| `deudas` | `userId`, `nombre`, `tipo`, `frecuencia`, `cuota`, `cuotasTotal`, `cuotasPagadas`, `saldo`, `proximoPago`, `activa` |
| `metas` | `userId`, `nombre`, `precio`, `apartado`, `tipo` (necesito/quiero), `prioridad`, `completada` |
| `ventas` | `userId`, `monto`, `moneda` (USD/VES), `tasa`, `descripcion`, `metodo`, `fecha`, `hora` |
| `proveedores` | `userId`, `empresa`, `concepto`, `monto`, `moneda`, `saldo`, `vence`, `pagado` |
| `cajas` | `userId`, `meta`, `numeros` (lista), `tachados` (posiciones), `completada` |
| `tasas` | caché de la tasa BCV (`_id: "bcv"`, `valor`, `actualizado`) |

`movimientos` ahora también guarda `espacio` (personal/negocio), `moneda` y `tasa`. Los datos viejos sin esos campos se toman como personales y en dólares.

Todas las consultas filtran por `userId` del token, así que nadie ve datos de otro.

---

## Cambios frecuentes (desde la web de GitHub)

- **Colores:** `css/app.css`, al inicio (`--brand`, `--sage`, `--sand`…). El bloque siguiente es el modo oscuro.
- **Textos de la presentación:** `js/app.js`, constante `INTRO`.
- **Gastos fijos sugeridos:** `js/app.js`, constante `FIJOS_COMUNES`.
- **Categorías de gasto:** `js/app.js` (vista `formGasto`) **y** `lib/util.js` (`CATEGORIAS`): deben coincidir.
- **Reglas de las alertas:** `js/calc.js`, función `revisarGasto`.
- Después de cambiar archivos de la app, sube el número en `sw.js` (`koing-v4` → `koing-v5`) para que los teléfonos tomen la versión nueva.

---

## Actualizar desde la versión anterior

1. Sube **todo** el contenido del zip a GitHub (arrastra también las carpetas `api`, `css`, `icons`, `js` y `lib`) y reemplaza los archivos.
2. En Vercel agrega `GMAIL_USER`, `GMAIL_APP_PASSWORD` y `APP_URL` y haz **Redeploy**.
3. Si ya tenías cuenta: entra a **Ajustes → Emprendimiento o negocio**, elige *Sí, un emprendimiento*, ponle nombre y **Guardar**. Aparece el selector arriba.

---

## App para Android (APK)

Se generó con PWABuilder (paquete `app.koing.android`). El APK abre `https://koing-seven.vercel.app` como app de pantalla completa, así que **cualquier cambio que subas a GitHub/Vercel llega solo a la app**, sin generar otro APK.

- `/.well-known/assetlinks.json` (ya incluido) le demuestra a Android que la app es tuya. Sin ese archivo la app muestra una barra con la dirección arriba.
- Guarda en un lugar seguro `signing.keystore` y `signing-key-info.txt` (quedaron en tu carpeta Descargas → KOING-APK). Los necesitas para publicar actualizaciones en Google Play. No los subas a GitHub.
- Si cambias de dominio, hay que generar el APK de nuevo.
