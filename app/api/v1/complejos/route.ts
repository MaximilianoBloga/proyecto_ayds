import { auth } from '@clerk/nextjs/server'
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { NextRequest } from 'next/server'

function getPrisma() {
  const url = process.env.DATABASE_URL
  if (!url) throw new Error('DATABASE_URL no configurado')
  const adapter = new PrismaPg(url)
  return new PrismaClient({ adapter })
}

function errorJson(code: string, message: string, status: number, details?: string) {
  return Response.json(
    { error: { code, message, ...(details ? { details } : {}) } },
    { status }
  )
}

// Endpoint para listar complejos deportivos
export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1') || 1)
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') ?? '20') || 20))

  const prisma = getPrisma()
  try {
    const total = await prisma.complejo.count()
    const data = await prisma.complejo.findMany({
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { id_complejo: 'asc' },
    })

    return Response.json({
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[GET /complejos]', msg)
    return errorJson('INTERNAL_ERROR', 'Error interno del servidor', 500, msg)
  } finally {
    await prisma.$disconnect()
  }
}

// Endpoint para crear un nuevo complejo deportivo (solo admin)
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
    if (usuario.rol !== 'admin') return errorJson('FORBIDDEN', 'Se requiere rol admin', 403)

    let body: { nombre?: unknown; direccion?: unknown }
    try {
      body = await req.json()
    } catch {
      return errorJson('BAD_REQUEST', 'Body JSON inválido', 400)
    }

    const { nombre, direccion } = body

    if (!nombre || typeof nombre !== 'string' || nombre.trim() === '') {
      return errorJson('VALIDATION_ERROR', 'El nombre es requerido', 422)
    }
    if (nombre.length > 100) {
      return errorJson('VALIDATION_ERROR', 'El nombre no puede superar 100 caracteres', 422)
    }
    if (!direccion || typeof direccion !== 'string' || direccion.trim() === '') {
      return errorJson('VALIDATION_ERROR', 'La dirección es requerida', 422)
    }
    if (direccion.length > 255) {
      return errorJson('VALIDATION_ERROR', 'La dirección no puede superar 255 caracteres', 422)
    }

    const complejo = await prisma.complejo.create({
      data: {
        nombre: nombre.trim(),
        direccion: direccion.trim(),
        email_administrador: usuario.email,
      },
    })

    return Response.json(complejo, {
      status: 201,
      headers: { Location: `/api/v1/complejos/${complejo.id_complejo}` },
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[POST /complejos]', msg)
    return errorJson('INTERNAL_ERROR', 'Error interno del servidor', 500, msg)
  } finally {
    await prisma.$disconnect()
  }
}
