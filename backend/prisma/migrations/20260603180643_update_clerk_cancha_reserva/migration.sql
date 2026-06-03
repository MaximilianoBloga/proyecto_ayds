-- Migración: update_clerk_cancha_reserva
-- Estado de la DB al aplicar:
--   - clerk_user_id ya existe en Usuario (de intento previo parcial)
--   - EstadoCancha ya tiene los valores nuevos (disponible/ocupada/en mantenimiento)
--   - estado_operativo todavía referencia EstadoCancha_old (Disponible/EnMantenimiento)
--   - TipoPartido y tipo_partido no existen aún

-- ── 1. clerk_user_id — asegurar constraint UNIQUE ────────────────────────
ALTER TABLE "Usuario" ADD COLUMN IF NOT EXISTS "clerk_user_id" VARCHAR(255) NOT NULL DEFAULT '';
ALTER TABLE "Usuario" ALTER COLUMN "clerk_user_id" DROP DEFAULT;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Usuario_clerk_user_id_key'
  ) THEN
    ALTER TABLE "Usuario" ADD CONSTRAINT "Usuario_clerk_user_id_key" UNIQUE ("clerk_user_id");
  END IF;
END $$;

-- ── 2. Migrar estado_operativo de EstadoCancha_old a EstadoCancha ─────────
ALTER TABLE "Cancha"
  ALTER COLUMN "estado_operativo" TYPE "EstadoCancha"
  USING (
    CASE "estado_operativo"::text
      WHEN 'Disponible'      THEN 'disponible'::"EstadoCancha"
      WHEN 'EnMantenimiento' THEN 'en mantenimiento'::"EstadoCancha"
      ELSE                        'disponible'::"EstadoCancha"
    END
  );

ALTER TABLE "Cancha" ALTER COLUMN "estado_operativo" SET DEFAULT 'disponible'::"EstadoCancha";

DROP TYPE IF EXISTS "EstadoCancha_old";

-- ── 3. Nuevo enum TipoPartido + columna en Reserva ───────────────────────
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'TipoPartido') THEN
    CREATE TYPE "TipoPartido" AS ENUM ('abierto', 'cerrado');
  END IF;
END $$;

ALTER TABLE "Reserva" ADD COLUMN IF NOT EXISTS "tipo_partido" "TipoPartido" NOT NULL DEFAULT 'cerrado';
ALTER TABLE "Reserva" ALTER COLUMN "tipo_partido" DROP DEFAULT;

-- ── 4. cupos_disponibles pasa a nullable ─────────────────────────────────
ALTER TABLE "Reserva" ALTER COLUMN "cupos_disponibles" DROP NOT NULL;
