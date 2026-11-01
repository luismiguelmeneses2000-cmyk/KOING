# KOING

PWA de finanzas personales: ingresos, gastos, deudas a crédito, lo que deberás por quincena y metas (lo que necesitas o quieres comprar), con avisos antes de gastar.

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

4. *Deploy*. Al terminar, abre la URL desde el teléfono.

### 4. Instalarla en el teléfono
- **Android (Chrome):** menú ⋮ → *Instalar app* / *Agregar a pantalla principal*.
- **iPhone (Safari):** botón Compartir → *Agregar a inicio*.

---

## Qué hace

| Pantalla | Qué tiene |
|---|---|
| Presentación | El cerdito entra rebotando y explica la app en 4 pasos. |
| Crear cuenta / Entrar | Correo y clave. Los datos quedan en tu cuenta (ves lo mismo en cualquier teléfono). |
| 7 preguntas | Nombre y moneda · cada cuánto cobras · cuánto · deudas · gastos fijos · metas · cuánto apartar. Así la app arranca armada y no tienes que cargar todo a mano. |
| Inicio | Disponible para gastar en la quincena (o semana/mes), desglose, tu meta #1, próximos pagos y últimos movimientos. |
| Botón **+** | Gasto, pago de deuda, ingreso extra, deuda nueva o meta. |
| Gasto | Si es **A crédito**, crea la deuda sola con sus cuotas. Antes de guardar revisa si el gasto pone en riesgo tu meta #1 o tu presupuesto y te avisa (“Si gastas esto, no podrás comprar…”). |
| Deudas | Agrupadas por tipo (cuotas, tarjeta, préstamo, otra): cuota, frecuencia, hasta cuándo y cuántas llevas. |
| Lo que deberé por quincena | Tabla de los próximos 6 periodos: cuánto debes y cuánto te queda. Exporta a Excel. |
| Metas | “Lo que necesito” y “Lo que quiero”, por prioridad (subir/bajar), apartar dinero, fecha estimada, marcar como comprada. |
| Movimientos | Por periodo, con flechas para ver periodos anteriores. Exporta a Excel (CSV). |
| Ajustes | Cobro, ingreso, moneda, gastos fijos, cuánto apartar, cerrar sesión, borrar cuenta. |

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
api/auth.js              Registro e inicio de sesión
api/perfil.js            Perfil + carga de todos los datos + borrar cuenta
api/items.js             Movimientos, deudas y metas (crear, editar, borrar, pagar, reordenar)
lib/db.js                Conexión a MongoDB (reutilizada entre llamadas)
lib/auth.js              JWT
lib/util.js              Limpieza de datos y fechas
icons/                   Íconos de la app
```

Son **3 funciones serverless** (Vercel Hobby permite hasta 12). El código compartido va en `/lib`, que no cuenta como función.

### Colecciones en MongoDB

| Colección | Campos principales |
|---|---|
| `users` | `email` (único), `nombre`, `passHash`, `createdAt` |
| `perfiles` | `userId`, `nombre`, `frecuencia`, `ingreso`, `moneda`, `fijos[]`, `apartar`, `avisos`, `onboarded` |
| `movimientos` | `userId`, `tipo` (gasto/ingreso/pago/ahorro), `monto`, `descripcion`, `categoria`, `metodo`, `fecha` (AAAA-MM-DD), `deudaId`, `metaId` |
| `deudas` | `userId`, `nombre`, `tipo`, `frecuencia`, `cuota`, `cuotasTotal`, `cuotasPagadas`, `saldo`, `proximoPago`, `activa` |
| `metas` | `userId`, `nombre`, `precio`, `apartado`, `tipo` (necesito/quiero), `prioridad`, `completada` |

Todas las consultas filtran por `userId` del token, así que nadie ve datos de otro.

---

## Cambios frecuentes (desde la web de GitHub)

- **Colores:** `css/app.css`, al inicio (`--brand`, `--sage`, `--sand`…). El bloque siguiente es el modo oscuro.
- **Textos de la presentación:** `js/app.js`, constante `INTRO`.
- **Gastos fijos sugeridos:** `js/app.js`, constante `FIJOS_COMUNES`.
- **Categorías de gasto:** `js/app.js` (vista `formGasto`) **y** `lib/util.js` (`CATEGORIAS`): deben coincidir.
- **Reglas de las alertas:** `js/calc.js`, función `revisarGasto`.
- Después de cambiar archivos de la app, sube el número en `sw.js` (`koing-v1` → `koing-v2`) para que los teléfonos tomen la versión nueva.
