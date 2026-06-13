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

function formatTime(val: Date | string | unknown): string {
  if (val instanceof Date) return val.toISOString().substring(11, 16)
  return String(val).substring(0, 5)
}

function parseTime(hhmm: string): Date {
  return new Date(`1970-01-01T${hhmm}:00.000Z`)
}

function mapEstadoToApi(estado: string): string {
  return estado === 'en_mantenimiento' ? 'en mantenimiento' : estado
}

function mapEstadoFromApi(valor: string): 'disponible' | 'ocupada' | 'en_mantenimiento' | null {
  if (valor === 'disponible') return 'disponible'
  if (valor === 'ocupada') return 'ocupada'
  if (valor === 'en mantenimiento') return 'en_mantenimiento'
  return null
}

function esHoraValida(h: string): boolean {
  if (!/^\d{2}:\d{2}$/.test(h)) return false
  return parseInt(h.slice(0, 2)) < 24 && parseInt(h.slice(3, 5)) < 60
}

function horaEnMinutos(h: string): number {
  return parseInt(h.slice(0, 2)) * 60 + parseInt(h.slice(3, 5))
}

function canchaToResponse(c: {
  id_cancha: number
  nombre: string
  deporte: string
  estado_operativo: string
  horario_apertura: Date | string | unknown
  horario_cierre: Date | string | unknown
  duracion_turno: number
  id_complejo: number
}) {
  return {
    idCancha: c.id_cancha,
    nombre: c.nombre,
    deporte: c.deporte,
    estadoOperativo: mapEstadoToApi(c.estado_operativo),
    horarioApertura: formatTime(c.horario_apertura),
    horarioCierre: formatTime(c.horario_cierre),
    duracionTurno: c.duracion_turno,
    idComplejo: c.id_complejo,
  }
}

type Params = { idCancha: string }

export async function GET(_req: NextRequest, { params }: { params: Promise<Params> }) {
  const { idCancha } = await params
  const id = parseInt(idCancha)
  if (isNaN(id)) return errorJson('BAD_REQUEST', 'ID inválido', 400)

  const prisma = getPrisma()
  try {
    const cancha = await prisma.cancha.findUnique({ where: { id_cancha: id } })
    if (!cancha) return errorJson('NOT_FOUND', 'Cancha no encontrada', 404)
    return Response.json(canchaToResponse(cancha))
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[GET /canchas/:id]', msg)
    return errorJson('INTERNAL_ERROR', 'Error interno del servidor', 500, msg)
  } finally {
    await prisma.$disconnect()
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<Params> }) {
  const { userId } = await auth()
  if (!userId) return errorJson('UNAUTHORIZED', 'No autenticado', 401)

  const { idCancha } = await params
  const id = parseInt(idCancha)
  if (isNaN(id)) return errorJson('BAD_REQUEST', 'ID inválido', 400)

  const prisma = getPrisma()
  try {
    const usuario = await prisma.usuario.findFirst({
      where: { clerk_user_id: userId },
      select: { email: true, rol: true },
    })
    if (!usuario) return errorJson('UNAUTHORIZED', 'Usuario no encontrado', 401)
    if (usuario.rol !== 'admin' && usuario.rol !== 'auxiliar') {
      return errorJson('FORBIDDEN', 'Se requiere rol admin o auxiliar', 403)
    }

    const cancha = await prisma.cancha.findUnique({ where: { id_cancha: id } })
    if (!cancha) return errorJson('NOT_FOUND', 'Cancha no encontrada', 404)

    // Verificación de ownership según rol
    if (usuario.rol === 'admin') {
      const complejo = await prisma.complejo.findUnique({ where: { id_complejo: cancha.id_complejo } })
      if (!complejo || complejo.email_administrador !== usuario.email) {
        return errorJson('FORBIDDEN', 'No sos el administrador de este complejo', 403)
      }
    } else {
      const auxiliar = await prisma.auxiliar.findUnique({ where: { email: usuario.email } })
      if (!auxiliar || auxiliar.id_complejo !== cancha.id_complejo) {
        return errorJson('FORBIDDEN', 'No tenés permiso para modificar canchas de este complejo', 403)
      }
    }

    let body: Record<string, unknown>
    try {
      body = await req.json()
    } catch {
      return errorJson('BAD_REQUEST', 'Body JSON inválido', 400)
    }

    const { nombre, deporte, estadoOperativo, horarioApertura, horarioCierre, duracionTurno } = body

    // El auxiliar solo puede cambiar estadoOperativo
    if (usuario.rol === 'auxiliar') {
      if (estadoOperativo === undefined) {
        return errorJson('BAD_REQUEST', 'No se enviaron campos a modificar', 400)
      }
      if (typeof estadoOperativo !== 'string') {
        return errorJson('VALIDATION_ERROR', 'estadoOperativo inválido', 400)
      }
      const estadoPrisma = mapEstadoFromApi(estadoOperativo)
      if (!estadoPrisma) {
        return errorJson(
          'VALIDATION_ERROR',
          'estadoOperativo debe ser disponible, ocupada o en mantenimiento',
          400
        )
      }
      const actualizada = await prisma.cancha.update({
        where: { id_cancha: id },
        data: { estado_operativo: estadoPrisma },
      })
      return Response.json(canchaToResponse(actualizada))
    }

    // Admin: validación completa de todos los campos
    type CanchaUpdate = {
      nombre?: string
      deporte?: string
      estado_operativo?: 'disponible' | 'ocupada' | 'en_mantenimiento'
      horario_apertura?: Date
      horario_cierre?: Date
      duracion_turno?: number
    }
    const data: CanchaUpdate = {}

    if (nombre !== undefined) {
      if (typeof nombre !== 'string' || nombre.trim() === '') {
        return errorJson('VALIDATION_ERROR', 'El nombre no puede estar vacío', 400)
      }
      if (nombre.length > 100) {
        return errorJson('VALIDATION_ERROR', 'El nombre no puede superar 100 caracteres', 400)
      }
      data.nombre = nombre.trim()
    }

    if (deporte !== undefined) {
      if (typeof deporte !== 'string' || deporte.trim() === '') {
        return errorJson('VALIDATION_ERROR', 'El deporte no puede estar vacío', 400)
      }
      if (deporte.length > 50) {
        return errorJson('VALIDATION_ERROR', 'El deporte no puede superar 50 caracteres', 400)
      }
      data.deporte = deporte.trim()
    }

    if (estadoOperativo !== undefined) {
      if (typeof estadoOperativo !== 'string') {
        return errorJson('VALIDATION_ERROR', 'estadoOperativo inválido', 400)
      }
      const estadoPrisma = mapEstadoFromApi(estadoOperativo)
      if (!estadoPrisma) {
        return errorJson(
          'VALIDATION_ERROR',
          'estadoOperativo debe ser disponible, ocupada o en mantenimiento',
          400
        )
      }
      data.estado_operativo = estadoPrisma
    }

    const nuevaApertura = horarioApertura !== undefined ? String(horarioApertura) : null
    const nuevoCierre = horarioCierre !== undefined ? String(horarioCierre) : null

    if (nuevaApertura !== null && !esHoraValida(nuevaApertura)) {
      return errorJson('VALIDATION_ERROR', 'Formato de horario de apertura inválido (HH:mm)', 400)
    }
    if (nuevoCierre !== null && !esHoraValida(nuevoCierre)) {
      return errorJson('VALIDATION_ERROR', 'Formato de horario de cierre inválido (HH:mm)', 400)
    }

    const aperturaFinal = nuevaApertura ?? formatTime(cancha.horario_apertura)
    const cierreFinal = nuevoCierre ?? formatTime(cancha.horario_cierre)
    if (horaEnMinutos(cierreFinal) <= horaEnMinutos(aperturaFinal)) {
      return errorJson('VALIDATION_ERROR', 'El horario de cierre debe ser posterior al de apertura', 400)
    }

    if (nuevaApertura !== null) data.horario_apertura = parseTime(nuevaApertura)
    if (nuevoCierre !== null) data.horario_cierre = parseTime(nuevoCierre)

    if (duracionTurno !== undefined) {
      const duracion = Number(duracionTurno)
      if (!Number.isInteger(duracion) || duracion <= 0) {
        return errorJson('VALIDATION_ERROR', 'La duración del turno debe ser un entero positivo', 400)
      }
      data.duracion_turno = duracion
    }

    if (Object.keys(data).length === 0) {
      return errorJson('BAD_REQUEST', 'No se enviaron campos a modificar', 400)
    }

    const actualizada = await prisma.cancha.update({ where: { id_cancha: id }, data })
    return Response.json(canchaToResponse(actualizada))
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[PATCH /canchas/:id]', msg)
    return errorJson('INTERNAL_ERROR', 'Error interno del servidor', 500, msg)
  } finally {
    await prisma.$disconnect()
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<Params> }) {
  const { userId } = await auth()
  if (!userId) return errorJson('UNAUTHORIZED', 'No autenticado', 401)

  const { idCancha } = await params
  const id = parseInt(idCancha)
  if (isNaN(id)) return errorJson('BAD_REQUEST', 'ID inválido', 400)

  const prisma = getPrisma()
  try {
    const usuario = await prisma.usuario.findFirst({
      where: { clerk_user_id: userId },
      select: { email: true, rol: true },
    })
    if (!usuario) return errorJson('UNAUTHORIZED', 'Usuario no encontrado', 401)
    if (usuario.rol !== 'admin') return errorJson('FORBIDDEN', 'Se requiere rol admin', 403)

    const cancha = await prisma.cancha.findUnique({ where: { id_cancha: id } })
    if (!cancha) return errorJson('NOT_FOUND', 'Cancha no encontrada', 404)

    const complejo = await prisma.complejo.findUnique({ where: { id_complejo: cancha.id_complejo } })
    if (!complejo || complejo.email_administrador !== usuario.email) {
      return errorJson('FORBIDDEN', 'No sos el administrador de este complejo', 403)
    }

    await prisma.cancha.delete({ where: { id_cancha: id } })

    return new Response(null, { status: 204 })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[DELETE /canchas/:id]', msg)
    return errorJson('INTERNAL_ERROR', 'Error interno del servidor', 500, msg)
  } finally {
    await prisma.$disconnect()
  }
}
