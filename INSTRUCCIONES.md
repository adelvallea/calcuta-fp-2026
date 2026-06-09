# Gran Calcuta · Mundial 2026 — Instrucciones

## Datos extraídos de tus archivos

### 18 Lotes (verificados del Excel y PowerPoint)
| # | Tipo | Equipos | Prob. Campeón | Prob. #32 | Prob. Último |
|---|------|---------|:---:|:---:|:---:|
| 1 | Solo | España | 14.3% | 0% | 0% |
| 2 | Solo | Francia | 13.1% | 0% | 0% |
| 3 | Solo | Inglaterra | 10.5% | 0% | 0% |
| 4 | Solo | Brasil | 8.7% | 0% | 0% |
| 5 | Solo | Portugal | 8.7% | 0% | 0% |
| 6 | Solo | Argentina | 7.8% | 0% | 0% |
| 7 | Solo | Alemania | 5.2% | 0% | 0% |
| 8 | Combo 3 | Países Bajos + Noruega + Bélgica | 9.1% | 1.0% | 0% |
| 9 | Combo 4 | Japón + Canadá + Sudáfrica + Iraq | 2.7% | 9.8% | 10.8% |
| 10 | Combo 4 | USA + Croacia + Ghana + Haití | 2.7% | 10.0% | 10.7% |
| 11 | Combo 4 | Uruguay + Suiza + Arabia Saudita + Jordania | 2.7% | 10.0% | 10.6% |
| 12 | Combo 4 | México + Turquía + Uzbekistán + Nueva Zelanda | 2.7% | 9.9% | 10.5% |
| 13 | Combo 4 | Marruecos + Ecuador + Argelia + RD Congo | 2.8% | 9.6% | 10.6% |
| 14 | Combo 4 | Colombia + Senegal + Bosnia + Rep. Checa | 3.4% | 8.8% | 11.0% |
| 15 | Combo 3 | Costa de Marfil + Panamá + Cabo Verde | 1.0% | 8.3% | 11.1% |
| 16 | Combo 3 | Escocia + Irán + Catar | 1.0% | 8.3% | 11.1% |
| 17 | Combo 4 | Austria + Corea del Sur + Egipto + Curazao | 1.8% | 12.2% | 6.8% |
| 18 | Combo 4 | Paraguay + Australia + Suecia + Túnez | 1.8% | 12.1% | 6.7% |

### Reparto de la bolsa
- **1.º Campeón:** 30%
- **2.º Subcampeón:** 20%
- **3.er lugar:** 10%
- **32.º Peor de 16avos:** 20% (último lugar de fase eliminatoria)
- **48.º Último lugar:** 20% (peor récord global en fase de grupos)

### Supuestos financieros
- Buy-in: **$1,000 MXN** obligatorio por persona
- Polla esperada: **$18,000** (12 personas × $1,500 puja promedio)
- Rango: Piso $12,000 / Esperado $18,000 / Techo $24,000

---

## Pasos para correr localmente

### 1. Instalar Node.js
Descarga Node.js LTS desde https://nodejs.org (si no lo tienes).
Verifica: `node --version` debe mostrar v18 o superior.

### 2. Crear proyecto Supabase
1. Ve a https://supabase.com y crea un proyecto gratis
2. En el dashboard de Supabase → SQL Editor
3. Copia y pega el contenido de `supabase/migrations/001_initial.sql`
4. Haz clic en "Run"
5. Copia tu **Project URL** y **anon key** (Settings → API)

### 3. Configurar variables de entorno
```bash
cp .env.local.example .env.local
```
Edita `.env.local`:
```
NEXT_PUBLIC_SUPABASE_URL=https://XXXX.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc...
ADMIN_PIN=1234
```

### 4. Instalar dependencias
```bash
cd calcuta-mundial-2026
npm install
```

### 5. Cargar datos iniciales (seed)
```bash
npm run seed
```
Esto inserta los 48 equipos, 18 lotes, reglas de premios y configuración inicial.

### 6. Correr en desarrollo
```bash
npm run dev
```
Abre http://localhost:3000

---

## Deploy en Vercel

### Opción A: GitHub (recomendado)
1. Sube el proyecto a GitHub
2. Ve a https://vercel.com → "New Project" → importa el repo
3. En "Environment Variables" agrega las mismas variables del `.env.local`
4. Deploy automático

### Opción B: Vercel CLI
```bash
npm i -g vercel
vercel login
vercel --prod
```

---

## Flujo del evento (día de la subasta)

1. **Antes del evento:**
   - Agrega participantes en `/participants`
   - Verifica que los 18 lotes están cargados en `/lots`
   - Proyecta la pantalla principal (puedes mostrar `/public` en la pantalla grande)

2. **Durante la subasta:**
   - Ve a `/auction` y selecciona el Lote 1
   - La URL `/auction/live/[id]` es la pantalla de subasta — puedes proyectarla
   - Usa el panel derecho para registrar bids y vender lotes
   - Los cambios se actualizan en **tiempo real** en todas las pantallas conectadas

3. **Después de la subasta:**
   - Verifica saldos en `/payments`
   - Registra pagos recibidos en `/participants`
   - Durante el Mundial actualiza resultados en `/results`
   - Los premios estimados se actualizan automáticamente en `/prizes`

---

## Archivos creados

```
calcuta-mundial-2026/
├── package.json
├── tsconfig.json
├── next.config.ts
├── tailwind.config.ts           ← Colores exactos del PowerPoint (#C9A227 gold, #14233A navy)
├── .env.local.example
├── supabase/
│   └── migrations/001_initial.sql   ← Schema completo con RLS y Realtime
├── seed/
│   ├── teams.json               ← 48 equipos (datos del Excel/PPT)
│   ├── lots.json                ← 18 lotes con probabilidades reales
│   ├── prizeRules.json          ← Reglas de reparto
│   └── seed.ts                  ← Script de carga
├── src/
│   ├── types/index.ts           ← Todos los tipos TypeScript
│   ├── lib/
│   │   ├── calculations.ts      ← Motor de cálculos (puro, testeable)
│   │   ├── results-provider.ts  ← Abstracción para API de resultados
│   │   └── supabase/            ← Cliente Supabase (server + client)
│   ├── components/
│   │   ├── layout/Sidebar.tsx
│   │   └── auction/LiveAuctionBoard.tsx   ← UI de subasta en vivo
│   └── app/
│       ├── (admin)/
│       │   ├── dashboard/page.tsx
│       │   ├── auction/page.tsx
│       │   ├── auction/live/[lotId]/page.tsx
│       │   ├── participants/page.tsx
│       │   ├── lots/page.tsx
│       │   ├── payments/page.tsx
│       │   ├── results/page.tsx
│       │   ├── prizes/page.tsx
│       │   └── settings/page.tsx
│       └── public/page.tsx
```

---

## Checklist MVP

- [ ] Crear cuenta Supabase y ejecutar migration SQL
- [ ] Configurar `.env.local`
- [ ] `npm install && npm run seed`
- [ ] `npm run dev` — verificar que carga sin errores
- [ ] Agregar participantes en `/participants`
- [ ] Probar subasta: `/auction` → iniciar Lote 1 → registrar bids → vender
- [ ] Verificar bolsa y saldos en `/payments`
- [ ] Probar vista pública en `/public` (abrir en otro tab)
- [ ] Deploy en Vercel

---

## Lo que viene (Fase 2)
- Importar participantes desde Excel/CSV
- Copropiedad de lotes (asignar % a varios participantes)
- Panel de resultados con edición inline y actualización masiva
- Integración con API de resultados deportivos (football-data.org)
- Exportar premios y liquidación final a PDF/Excel
- Autenticación por roles (Admin / Moderador / Viewer)
