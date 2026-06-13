import { auth } from '@clerk/nextjs/server'
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { NextRequest } from 'next/server'

function getPrisma() {
  const url = process.env.DATABASE_URL
  if (!url) throw new Error('DATABASE_URL no configurado')
  return new PrismaClient({ adapter: new PrismaPg(url) })
}

function errorJson(code: string, message: string, status: number, details?: string) {
  return Response.json(
    { error: { code, message, ...(details ? { details } : {}) } },
    { status }
  )
}

function mapEstadoToApi(e: string) {
  return e.toLowerCase()
}

function mapEstadoFromApi(e: string): 'Pendiente' | 'Pagada' | 'Cancelada' | 'Ausente' | null {
  const m: Record<string, 'Pendiente' | 'Pagada' | 'Cancelada' | 'Ausente'> = {
    pendiente: 'Pendiente', pagada: 'Pagada', cancelada: 'Cancelada', ausente: 'Ausente',
  }
  return m[e.toLowerCase()] ?? null
}

function formatDate(val: Date | string | unknown): string {
  if (val instanceof Date) return val.toISOString().substring(0, 10)
  return String(val).substring(0, 10)
}

function formatTime(val: Date | string | unknown): string {
  if (val instanceof Date) return val.toISOString().substring(11, 16)
  return String(val).substring(0, 5)
}

function reservaToResponse(r: {
  id_reserva: number
  fecha: Date | string | unknown
  hora: Date | string | unknown
  estado: string
  tipo_partido: string
  cupos_disponibles: number | null
  id_cancha: number
  email_cliente: string
}) {
  return {
    idReserva: r.id_reserva,
    fecha: formatDate(r.fecha),
    hora: formatTime(r.hora),
    estado: mapEstadoToApi(r.estado),
    tipoPartido: r.tipo_partido,
    cuposDisponibles: r.cupos_disponibles,
    idCancha: r.id_cancha,
    emailCliente: r.email_cliente,
  }
}

type RouteContext = { params: Promise<{ idReserva: string }> }

// Endpoint para consultar datos de una reserva específica por ID (solo cliente dueño de la reserva o auxiliar del complejo puede acceder)
export async function GET(_req: NextRequest, ctx: RouteContext) {
  const { userId } = await auth()
  if (!userId) return errorJson('UNAUTHORIZED', 'No autenticado', 401)

  const { idReserva: idStr } = await ctx.params
  const idReserva = parseInt(idStr)
  if (isNaN(idReserva)) return errorJson('BAD_REQUEST', 'ID de reserva inválido', 400)

  const prisma = getPrisma()
  try {
    const usuario = await prisma.usuario.findFirst({
      where: { clerk_user_id: userId },
      select: { email: true, rol: true },
    })
    if (!usuario) return errorJson('UNAUTHORIZED', 'Usuario no encontrado', 401)
    if (usuario.rol === 'admin') return errorJson('FORBIDDEN', 'Sin acceso para admin', 403)

    const reserva = await prisma.reserva.findUnique({ where: { id_reserva: idReserva } })
    if (!reserva) return errorJson('NOT_FOUND', 'Reserva no encontrada', 404)

    if (usuario.rol === 'cliente') {
      if (reserva.email_cliente !== usuario.email) {
        return errorJson('FORBIDDEN', 'No tenés acceso a esta reserva', 403)
      }
    } else {
      // Auxiliar: verificar que la cancha pertenece a su complejo
      const auxiliar = await prisma.auxiliar.findUnique({ where: { email: usuario.email } })
      if (!auxiliar) return errorJson('FORBIDDEN', 'Auxiliar no encontrado', 403)
      const cancha = await prisma.cancha.findUnique({ where: { id_cancha: reserva.id_cancha } })
      if (!cancha || cancha.id_complejo !== auxiliar.id_complejo) {
        return errorJson('FORBIDDEN', 'No tenés acceso a esta reserva', 403)
      }
    }

    return Response.json(reservaToResponse(reserva))
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[GET /reservas/:id]', msg)
    return errorJson('INTERNAL_ERROR', 'Error interno del servidor', 500, msg)
  } finally {
    await prisma.$disconnect()
  }
}

// Endpoint para modificar el estado de una reserva (solo auxiliar del complejo puede acceder)
export async function PATCH(req: NextRequest, ctx: RouteContext) {
  const { userId } = await auth()
  if (!userId) return errorJson('UNAUTHORIZED', 'No autenticado', 401)

  const { idReserva: idStr } = await ctx.params
  const idReserva = parseInt(idStr)
  if (isNaN(idReserva)) return errorJson('BAD_REQUEST', 'ID de reserva inválido', 400)

  const prisma = getPrisma()
  try {
    const usuario = await prisma.usuario.findFirst({
      where: { clerk_user_id: userId },
      select: { email: true, rol: true },
    })
    if (!usuario) return errorJson('UNAUTHORIZED', 'Usuario no encontrado', 401)
    // Solo auxiliar puede hacer PATCH del estado
    if (usuario.rol === 'cliente' || usuario.rol === 'admin') {
      return errorJson('FORBIDDEN', 'Solo auxiliares pueden actualizar el estado de una reserva', 403)
    }

    let body: Record<string, unknown>
    try {
      body = await req.json()
    } catch {
      return errorJson('BAD_REQUEST', 'Body JSON inválido', 400)
    }

    const { estado } = body
    if (!estado || typeof estado !== 'string') {
      return errorJson('VALIDATION_ERROR', 'El campo estado es requerido', 400)
    }
    const estadoPrisma = mapEstadoFromApi(estado)
    if (!estadoPrisma) {
      return errorJson('VALIDATION_ERROR', 'Estado inválido. Valores: pendiente, pagada, cancelada, ausente', 400)
    }

    const reserva = await prisma.reserva.findUnique({ where: { id_reserva: idReserva } })
    if (!reserva) return errorJson('NOT_FOUND', 'Reserva no encontrada', 404)

    // Verificar que la cancha pertenece al complejo del auxiliar
    const auxiliar = await prisma.auxiliar.findUnique({ where: { email: usuario.email } })
    if (!auxiliar) return errorJson('FORBIDDEN', 'Auxiliar no encontrado', 403)
    const cancha = await prisma.cancha.findUnique({ where: { id_cancha: reserva.id_cancha } })
    if (!cancha || cancha.id_complejo !== auxiliar.id_complejo) {
      return errorJson('FORBIDDEN', 'No tenés acceso a esta reserva', 403)
    }

    const reservaActualizada = await prisma.reserva.update({
      where: { id_reserva: idReserva },
      data: { estado: estadoPrisma },
    })

    return Response.json({
      idReserva: reservaActualizada.id_reserva,
      estado: mapEstadoToApi(reservaActualizada.estado),
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[PATCH /reservas/:id]', msg)
    return errorJson('INTERNAL_ERROR', 'Error interno del servidor', 500, msg)
  } finally {
    await prisma.$disconnect()
  }
}

// Endpoint para cancelar una reserva (soft delete, solo cliente dueño de la reserva o auxiliar del complejo puede acceder, y con al menos 2 horas de anticipación)
export async function DELETE(_req: NextRequest, ctx: RouteContext) {
  const { userId } = await auth()
  if (!userId) return errorJson('UNAUTHORIZED', 'No autenticado', 401)

  const { idReserva: idStr } = await ctx.params
  const idReserva = parseInt(idStr)
  if (isNaN(idReserva)) return errorJson('BAD_REQUEST', 'ID de reserva inválido', 400)

  const prisma = getPrisma()
  try {
    const usuario = await prisma.usuario.findFirst({
      where: { clerk_user_id: userId },
      select: { email: true, rol: true },
    })
    if (!usuario) return errorJson('UNAUTHORIZED', 'Usuario no encontrado', 401)
    if (usuario.rol === 'admin') return errorJson('FORBIDDEN', 'Sin acceso para admin', 403)

    const reserva = await prisma.reserva.findUnique({ where: { id_reserva: idReserva } })
    if (!reserva) return errorJson('NOT_FOUND', 'Reserva no encontrada', 404)

    // Verificar acceso
    if (usuario.rol === 'cliente') {
      if (reserva.email_cliente !== usuario.email) {
        return errorJson('FORBIDDEN', 'No tenés acceso a esta reserva', 403)
      }
    } else {
      // Auxiliar
      const auxiliar = await prisma.auxiliar.findUnique({ where: { email: usuario.email } })
      if (!auxiliar) return errorJson('FORBIDDEN', 'Auxiliar no encontrado', 403)
      const cancha = await prisma.cancha.findUnique({ where: { id_cancha: reserva.id_cancha } })
      if (!cancha || cancha.id_complejo !== auxiliar.id_complejo) {
        return errorJson('FORBIDDEN', 'No tenés acceso a esta reserva', 403)
      }
    }

    // Verificar que ya no está cancelada
    if (reserva.estado === 'Cancelada') {
      return errorJson('UNPROCESSABLE_ENTITY', 'La reserva ya está cancelada', 422)
    }

    // 422: límite de 2 horas antes
    const fechaStr = formatDate(reserva.fecha)
    const horaStr = formatTime(reserva.hora)
    const fechaHoraReserva = new Date(`${fechaStr}T${horaStr}:00.000Z`)
    const ahora = new Date()
    const diferenciaMs = fechaHoraReserva.getTime() - ahora.getTime()
    const dosHorasMs = 2 * 60 * 60 * 1000

    if (diferenciaMs < dosHorasMs) {
      return errorJson(
        'UNPROCESSABLE_ENTITY',
        'No se puede cancelar una reserva con menos de 2 horas de anticipación',
        422
      )
    }

    // Soft delete: marcar como cancelada
    await prisma.reserva.update({
      where: { id_reserva: idReserva },
      data: { estado: 'Cancelada' },
    })

    return new Response(null, { status: 204 })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[DELETE /reservas/:id]', msg)
    return errorJson('INTERNAL_ERROR', 'Error interno del servidor', 500, msg)
  } finally {
    await prisma.$disconnect()
  }
}
