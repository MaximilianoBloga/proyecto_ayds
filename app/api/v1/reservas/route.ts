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

// API usa lowercase; Prisma usa PascalCase
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

function parseDate(s: string): Date {
  // Acepta "YYYY-MM-DD" o "YYYY-MM-DDTHH:mm:ssZ"
  return new Date(`${s.substring(0, 10)}T00:00:00.000Z`)
}

function parseTime(hhmm: string): Date {
  return new Date(`1970-01-01T${hhmm}:00.000Z`)
}

function esHoraValida(h: string): boolean {
  if (!/^\d{2}:\d{2}$/.test(h)) return false
  return parseInt(h.slice(0, 2)) < 24 && parseInt(h.slice(3, 5)) < 60
}

function horaEnMinutos(h: string): number {
  return parseInt(h.slice(0, 2)) * 60 + parseInt(h.slice(3, 5))
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

// Endpoint para listar reservas (admin no tiene acceso, cliente solo las suyas, auxiliar las de su complejo). Permite filtros por emailCliente, idCancha y fecha.
export async function GET(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) return errorJson('UNAUTHORIZED', 'No autenticado', 401)

  const prisma = getPrisma()
  try {
    const usuario = await prisma.usuario.findFirst({
      where: { clerk_user_id: userId },
      select: { email: true, rol: true },
    })
    if (!usuario) return errorJson('UNAUTHORIZED', 'Usuario no encontrado', 401)
    if (usuario.rol === 'admin') return errorJson('FORBIDDEN', 'Sin acceso para admin', 403)

    const { searchParams } = req.nextUrl
    const emailClienteParam = searchParams.get('emailCliente')
    const idCanchaParam = searchParams.get('idCancha')
    const fechaParam = searchParams.get('fecha')

    const idCanchaFiltro = idCanchaParam ? parseInt(idCanchaParam) : undefined
    const fechaFiltro = fechaParam ? parseDate(fechaParam) : undefined

    // Construir WHERE según rol
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: Record<string, any> = {}

    if (usuario.rol === 'cliente') {
      // Solo sus propias reservas
      where.email_cliente = usuario.email
      if (idCanchaFiltro && !isNaN(idCanchaFiltro)) where.id_cancha = idCanchaFiltro
    } else {
      // Auxiliar: reservas de canchas de su complejo
      const auxiliar = await prisma.auxiliar.findUnique({ where: { email: usuario.email } })
      if (!auxiliar) return errorJson('FORBIDDEN', 'Auxiliar no encontrado', 403)

      const canchasComplejo = await prisma.cancha.findMany({
        where: { id_complejo: auxiliar.id_complejo },
        select: { id_cancha: true },
      })
      const idsCanchas = canchasComplejo.map((c) => c.id_cancha)

      if (idCanchaFiltro && !isNaN(idCanchaFiltro)) {
        if (!idsCanchas.includes(idCanchaFiltro)) {
          return errorJson('FORBIDDEN', 'Esa cancha no pertenece a tu complejo', 403)
        }
        where.id_cancha = idCanchaFiltro
      } else {
        where.id_cancha = { in: idsCanchas }
      }

      if (emailClienteParam) where.email_cliente = emailClienteParam
    }

    if (fechaFiltro) where.fecha = fechaFiltro

    const reservas = await prisma.reserva.findMany({
      where,
      orderBy: [{ fecha: 'asc' }, { hora: 'asc' }],
    })

    return Response.json(reservas.map(reservaToResponse))
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[GET /reservas]', msg)
    return errorJson('INTERNAL_ERROR', 'Error interno del servidor', 500, msg)
  } finally {
    await prisma.$disconnect()
  }
}

// Endpoint para crear una reserva (cliente y auxiliar, no admin). Cliente solo puede reservar para su email, auxiliar para canchas de su complejo. Validaciones de horario, conflictos, etc.
export async function POST(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) return errorJson('UNAUTHORIZED', 'No autenticado', 401)

  const prisma = getPrisma()
  try {
    const usuario = await prisma.usuario.findFirst({
      where: { clerk_user_id: userId },
      select: { email: true, rol: true },
    })
    if (!usuario) return errorJson('UNAUTHORIZED', 'Usuario no encontrado', 401)
    if (usuario.rol === 'admin') return errorJson('FORBIDDEN', 'Sin acceso para admin', 403)

    let body: Record<string, unknown>
    try {
      body = await req.json()
    } catch {
      return errorJson('BAD_REQUEST', 'Body JSON inválido', 400)
    }

    const { fecha, hora, tipoPartido, idCancha, emailCliente, cuposDisponibles, pagarAhora } = body

    // Validaciones básicas
    if (!fecha || typeof fecha !== 'string') {
      return errorJson('VALIDATION_ERROR', 'La fecha es requerida (YYYY-MM-DD)', 400)
    }
    if (!hora || typeof hora !== 'string' || !esHoraValida(hora)) {
      return errorJson('VALIDATION_ERROR', 'La hora es requerida y debe tener formato HH:mm', 400)
    }
    if (!tipoPartido || (tipoPartido !== 'abierto' && tipoPartido !== 'cerrado')) {
      return errorJson('VALIDATION_ERROR', 'tipoPartido debe ser abierto o cerrado', 400)
    }
    if (!idCancha || typeof idCancha !== 'number' || !Number.isInteger(idCancha)) {
      return errorJson('VALIDATION_ERROR', 'idCancha es requerido', 400)
    }
    if (!emailCliente || typeof emailCliente !== 'string' || !emailCliente.includes('@')) {
      return errorJson('VALIDATION_ERROR', 'emailCliente es requerido y debe ser un email válido', 400)
    }

    // Validar cuposDisponibles para partido abierto
    if (tipoPartido === 'abierto') {
      if (cuposDisponibles === undefined || cuposDisponibles === null) {
        return errorJson('VALIDATION_ERROR', 'cuposDisponibles es requerido para partido abierto', 400)
      }
      const cupos = Number(cuposDisponibles)
      if (!Number.isInteger(cupos) || cupos <= 0) {
        return errorJson('VALIDATION_ERROR', 'cuposDisponibles debe ser un entero positivo', 400)
      }
    }

    // Autorización por rol
    if (usuario.rol === 'cliente') {
      if (emailCliente !== usuario.email) {
        return errorJson('FORBIDDEN', 'Solo podés reservar con tu propio email', 403)
      }
    } else {
      // Auxiliar
      const auxiliar = await prisma.auxiliar.findUnique({ where: { email: usuario.email } })
      if (!auxiliar) return errorJson('FORBIDDEN', 'Auxiliar no encontrado', 403)

      const cancha = await prisma.cancha.findUnique({ where: { id_cancha: idCancha as number } })
      if (!cancha) return errorJson('NOT_FOUND', 'Cancha no encontrada', 404)
      if (cancha.id_complejo !== auxiliar.id_complejo) {
        return errorJson('FORBIDDEN', 'Esa cancha no pertenece a tu complejo', 403)
      }
    }

    // Cargar cancha para validaciones
    const cancha = await prisma.cancha.findUnique({ where: { id_cancha: idCancha as number } })
    if (!cancha) return errorJson('NOT_FOUND', 'Cancha no encontrada', 404)

    // 422: cancha en mantenimiento
    if (cancha.estado_operativo === 'en_mantenimiento') {
      return errorJson('UNPROCESSABLE_ENTITY', 'La cancha está en mantenimiento', 422)
    }

    // Validar que el email del cliente existe y tiene rol cliente
    const clienteUsuario = await prisma.usuario.findUnique({
      where: { email: emailCliente as string },
      select: { rol: true },
    })
    if (!clienteUsuario) {
      return errorJson('NOT_FOUND', 'El cliente no existe en el sistema', 404)
    }
    if (clienteUsuario.rol !== 'cliente') {
      return errorJson('VALIDATION_ERROR', 'El emailCliente debe corresponder a un usuario con rol cliente', 400)
    }

    // Validar hora dentro del horario de la cancha y alineada a bloques
    const aperturaMin = horaEnMinutos(formatTime(cancha.horario_apertura))
    const cierreMin = horaEnMinutos(formatTime(cancha.horario_cierre))
    const horaMin = horaEnMinutos(hora)

    if (horaMin < aperturaMin || horaMin >= cierreMin) {
      return errorJson('VALIDATION_ERROR', `La hora debe estar entre ${formatTime(cancha.horario_apertura)} y ${formatTime(cancha.horario_cierre)}`, 400)
    }
    if ((horaMin - aperturaMin) % cancha.duracion_turno !== 0) {
      return errorJson('VALIDATION_ERROR', `La hora debe estar alineada a bloques de ${cancha.duracion_turno} minutos`, 400)
    }

    // 409: conflicto de horario
    const fechaParsed = parseDate(fecha)
    const horaParsed = parseTime(hora)

    const conflicto = await prisma.reserva.findFirst({
      where: {
        id_cancha: idCancha as number,
        fecha: fechaParsed,
        hora: horaParsed,
        estado: { in: ['Pendiente', 'Pagada'] },
      },
    })
    if (conflicto) {
      return errorJson('CONFLICT', 'Ya existe una reserva activa para esa cancha en ese horario', 409)
    }

    // Determinar estado inicial
    let estadoInicial: 'Pendiente' | 'Pagada'
    if (usuario.rol === 'auxiliar') {
      estadoInicial = 'Pagada'
    } else {
      estadoInicial = pagarAhora === true ? 'Pagada' : 'Pendiente'
    }

    const reserva = await prisma.reserva.create({
      data: {
        fecha: fechaParsed,
        hora: horaParsed,
        estado: estadoInicial,
        tipo_partido: tipoPartido as 'abierto' | 'cerrado',
        cupos_disponibles: tipoPartido === 'abierto' ? Number(cuposDisponibles) : null,
        id_cancha: idCancha as number,
        email_cliente: emailCliente as string,
      },
    })

    return Response.json(reservaToResponse(reserva), {
      status: 201,
      headers: { Location: `/api/v1/reservas/${reserva.id_reserva}` },
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[POST /reservas]', msg)
    return errorJson('INTERNAL_ERROR', 'Error interno del servidor', 500, msg)
  } finally {
    await prisma.$disconnect()
  }
}
