-- CreateEnum
CREATE TYPE "Rol" AS ENUM ('admin', 'auxiliar', 'cliente');

-- CreateEnum
CREATE TYPE "EstadoReserva" AS ENUM ('Pendiente', 'Pagada', 'Cancelada', 'Ausente');

-- CreateEnum
CREATE TYPE "EstadoCancha" AS ENUM ('Disponible', 'EnMantenimiento');

-- CreateTable
CREATE TABLE "Usuario" (
    "email" VARCHAR(255) NOT NULL,
    "nombre" VARCHAR(100) NOT NULL,
    "telefono" VARCHAR(20) NOT NULL,
    "rol" "Rol" NOT NULL,

    CONSTRAINT "Usuario_pkey" PRIMARY KEY ("email")
);

-- CreateTable
CREATE TABLE "Cliente" (
    "email" VARCHAR(255) NOT NULL,
    "buscando" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Cliente_pkey" PRIMARY KEY ("email")
);

-- CreateTable
CREATE TABLE "Auxiliar" (
    "email" VARCHAR(255) NOT NULL,
    "id_complejo" INTEGER NOT NULL,

    CONSTRAINT "Auxiliar_pkey" PRIMARY KEY ("email")
);

-- CreateTable
CREATE TABLE "Complejo" (
    "id_complejo" SERIAL NOT NULL,
    "nombre" VARCHAR(100) NOT NULL,
    "direccion" VARCHAR(255) NOT NULL,
    "email_administrador" VARCHAR(255) NOT NULL,

    CONSTRAINT "Complejo_pkey" PRIMARY KEY ("id_complejo")
);

-- CreateTable
CREATE TABLE "Cancha" (
    "id_cancha" SERIAL NOT NULL,
    "nombre" VARCHAR(100) NOT NULL,
    "horario_apertura" TIME NOT NULL,
    "horario_cierre" TIME NOT NULL,
    "duracion_turno" INTEGER NOT NULL,
    "deporte" VARCHAR(50) NOT NULL,
    "estado_operativo" "EstadoCancha" NOT NULL DEFAULT 'Disponible',
    "id_complejo" INTEGER NOT NULL,

    CONSTRAINT "Cancha_pkey" PRIMARY KEY ("id_cancha")
);

-- CreateTable
CREATE TABLE "Reserva" (
    "id_reserva" SERIAL NOT NULL,
    "fecha" DATE NOT NULL,
    "hora" TIME NOT NULL,
    "estado" "EstadoReserva" NOT NULL DEFAULT 'Pendiente',
    "cupos_disponibles" INTEGER NOT NULL,
    "id_cancha" INTEGER NOT NULL,
    "email_cliente" VARCHAR(255) NOT NULL,

    CONSTRAINT "Reserva_pkey" PRIMARY KEY ("id_reserva")
);

-- CreateTable
CREATE TABLE "Pago" (
    "id_pago" SERIAL NOT NULL,
    "id_reserva" INTEGER NOT NULL,
    "monto" DECIMAL(10,2) NOT NULL,

    CONSTRAINT "Pago_pkey" PRIMARY KEY ("id_pago")
);

-- CreateTable
CREATE TABLE "Equipamiento" (
    "id_equipamiento" SERIAL NOT NULL,
    "nombre" VARCHAR(100) NOT NULL,
    "precio" DECIMAL(10,2) NOT NULL,
    "stock" INTEGER NOT NULL,
    "stock_disponible" INTEGER NOT NULL,
    "id_complejo" INTEGER NOT NULL,

    CONSTRAINT "Equipamiento_pkey" PRIMARY KEY ("id_equipamiento")
);

-- CreateTable
CREATE TABLE "ReservaEquipamiento" (
    "id_reserva" INTEGER NOT NULL,
    "id_equipamiento" INTEGER NOT NULL,
    "cantidad" INTEGER NOT NULL,

    CONSTRAINT "ReservaEquipamiento_pkey" PRIMARY KEY ("id_reserva","id_equipamiento")
);

-- CreateTable
CREATE TABLE "Resenia" (
    "id_resenia" SERIAL NOT NULL,
    "comentario" TEXT NOT NULL,
    "calificacion" INTEGER NOT NULL,
    "email_cliente" VARCHAR(255) NOT NULL,
    "id_cancha" INTEGER NOT NULL,

    CONSTRAINT "Resenia_pkey" PRIMARY KEY ("id_resenia")
);

-- CreateTable
CREATE TABLE "Inasistencia" (
    "id_inasistencia" SERIAL NOT NULL,
    "fecha_inasistencia" DATE NOT NULL,
    "fecha_caducidad" DATE NOT NULL,
    "email_cliente" VARCHAR(255) NOT NULL,

    CONSTRAINT "Inasistencia_pkey" PRIMARY KEY ("id_inasistencia")
);

-- AddForeignKey
ALTER TABLE "Cliente" ADD CONSTRAINT "Cliente_email_fkey" FOREIGN KEY ("email") REFERENCES "Usuario"("email") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Auxiliar" ADD CONSTRAINT "Auxiliar_email_fkey" FOREIGN KEY ("email") REFERENCES "Usuario"("email") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Auxiliar" ADD CONSTRAINT "Auxiliar_id_complejo_fkey" FOREIGN KEY ("id_complejo") REFERENCES "Complejo"("id_complejo") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Complejo" ADD CONSTRAINT "Complejo_email_administrador_fkey" FOREIGN KEY ("email_administrador") REFERENCES "Usuario"("email") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Cancha" ADD CONSTRAINT "Cancha_id_complejo_fkey" FOREIGN KEY ("id_complejo") REFERENCES "Complejo"("id_complejo") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reserva" ADD CONSTRAINT "Reserva_id_cancha_fkey" FOREIGN KEY ("id_cancha") REFERENCES "Cancha"("id_cancha") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reserva" ADD CONSTRAINT "Reserva_email_cliente_fkey" FOREIGN KEY ("email_cliente") REFERENCES "Usuario"("email") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pago" ADD CONSTRAINT "Pago_id_reserva_fkey" FOREIGN KEY ("id_reserva") REFERENCES "Reserva"("id_reserva") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Equipamiento" ADD CONSTRAINT "Equipamiento_id_complejo_fkey" FOREIGN KEY ("id_complejo") REFERENCES "Complejo"("id_complejo") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReservaEquipamiento" ADD CONSTRAINT "ReservaEquipamiento_id_reserva_fkey" FOREIGN KEY ("id_reserva") REFERENCES "Reserva"("id_reserva") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReservaEquipamiento" ADD CONSTRAINT "ReservaEquipamiento_id_equipamiento_fkey" FOREIGN KEY ("id_equipamiento") REFERENCES "Equipamiento"("id_equipamiento") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Resenia" ADD CONSTRAINT "Resenia_email_cliente_fkey" FOREIGN KEY ("email_cliente") REFERENCES "Usuario"("email") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Resenia" ADD CONSTRAINT "Resenia_id_cancha_fkey" FOREIGN KEY ("id_cancha") REFERENCES "Cancha"("id_cancha") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Inasistencia" ADD CONSTRAINT "Inasistencia_email_cliente_fkey" FOREIGN KEY ("email_cliente") REFERENCES "Usuario"("email") ON DELETE RESTRICT ON UPDATE CASCADE;
