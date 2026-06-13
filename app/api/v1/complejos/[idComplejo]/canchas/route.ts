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

type Params = { idComplejo: string }

export async function GET(req: NextRequest, { params }: { params: Promise<Params> }) {
  const { idComplejo } = await params
  const id = parseInt(idComplejo)
  if (isNaN(id)) return errorJson('BAD_REQUEST', 'ID inválido', 400)

  const { searchParams } = req.nextUrl
  const filtroDeporte = searchParams.get('deporte')
  const filtroEstado = searchParams.get('estadoOperativo')

  let estadoPrisma: 'disponible' | 'ocupada' | 'en_mantenimiento' | undefined
  if (filtroEstado) {
    const mapeado = mapEstadoFromApi(filtroEstado)
    if (!mapeado) return errorJson('BAD_REQUEST', 'estadoOperativo inválido', 400)
    estadoPrisma = mapeado
  }

  const prisma = getPrisma()
  try {
    const complejo = await prisma.complejo.findUnique({ where: { id_complejo: id } })
    if (!complejo) return errorJson('NOT_FOUND', 'Complejo no encontrado', 404)

    const canchas = await prisma.cancha.findMany({
      where: {
        id_complejo: id,
        ...(filtroDeporte ? { deporte: filtroDeporte } : {}),
        ...(estadoPrisma ? { estado_operativo: estadoPrisma } : {}),
      },
      orderBy: { id_cancha: 'asc' },
    })

    return Response.json(canchas.map(canchaToResponse))
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[GET /complejos/:id/canchas]', msg)
    return errorJson('INTERNAL_ERROR', 'Error interno del servidor', 500, msg)
  } finally {
    await prisma.$disconnect()
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<Params> }) {
  const { userId } = await auth()
  if (!userId) return errorJson('UNAUTHORIZED', 'No autenticado', 401)

  const { idComplejo } = await params
  const id = parseInt(idComplejo)
  if (isNaN(id)) return errorJson('BAD_REQUEST', 'ID inválido', 400)

  const prisma = getPrisma()
  try {
    const usuario = await prisma.usuario.findFirst({
      where: { clerk_user_id: userId },
      select: { email: true, rol: true },
    })
    if (!usuario) return errorJson('UNAUTHORIZED', 'Usuario no encontrado', 401)
    if (usuario.rol !== 'admin') return errorJson('FORBIDDEN', 'Se requiere rol admin', 403)

    const complejo = await prisma.complejo.findUnique({ where: { id_complejo: id } })
    if (!complejo) return errorJson('NOT_FOUND', 'Complejo no encontrado', 404)
    if (complejo.email_administrador !== usuario.email) {
      return errorJson('FORBIDDEN', 'No sos el administrador de este complejo', 403)
    }

    let body: Record<string, unknown>
    try {
      body = await req.json()
    } catch {
      return errorJson('BAD_REQUEST', 'Body JSON inválido', 400)
    }

    const { nombre, deporte, horarioApertura, horarioCierre, duracionTurno } = body

    if (!nombre || typeof nombre !== 'string' || nombre.trim() === '') {
      return errorJson('VALIDATION_ERROR', 'El nombre es requerido', 400)
    }
    if (nombre.length > 100) {
      return errorJson('VALIDATION_ERROR', 'El nombre no puede superar 100 caracteres', 400)
    }
    if (!deporte || typeof deporte !== 'string' || deporte.trim() === '') {
      return errorJson('VALIDATION_ERROR', 'El deporte es requerido', 400)
    }
    if (deporte.length > 50) {
      return errorJson('VALIDATION_ERROR', 'El deporte no puede superar 50 caracteres', 400)
    }
    if (!horarioApertura || typeof horarioApertura !== 'string' || !esHoraValida(horarioApertura)) {
      return errorJson('VALIDATION_ERROR', 'Formato de horario de apertura inválido (HH:mm)', 400)
    }
    if (!horarioCierre || typeof horarioCierre !== 'string' || !esHoraValida(horarioCierre)) {
      return errorJson('VALIDATION_ERROR', 'Formato de horario de cierre inválido (HH:mm)', 400)
    }
    if (horaEnMinutos(horarioCierre) <= horaEnMinutos(horarioApertura)) {
      return errorJson('VALIDATION_ERROR', 'El horario de cierre debe ser posterior al de apertura', 400)
    }
    if (duracionTurno === undefined || duracionTurno === null) {
      return errorJson('VALIDATION_ERROR', 'La duración del turno es requerida', 400)
    }
    const duracion = Number(duracionTurno)
    if (!Number.isInteger(duracion) || duracion <= 0) {
      return errorJson('VALIDATION_ERROR', 'La duración del turno debe ser un entero positivo', 400)
    }

    const cancha = await prisma.cancha.create({
      data: {
        nombre: nombre.trim(),
        deporte: deporte.trim(),
        horario_apertura: parseTime(horarioApertura),
        horario_cierre: parseTime(horarioCierre),
        duracion_turno: duracion,
        id_complejo: id,
      },
    })

    return Response.json(canchaToResponse(cancha), {
      status: 201,
      headers: { Location: `/api/v1/canchas/${cancha.id_cancha}` },
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[POST /complejos/:id/canchas]', msg)
    return errorJson('INTERNAL_ERROR', 'Error interno del servidor', 500, msg)
  } finally {
    await prisma.$disconnect()
  }
}
