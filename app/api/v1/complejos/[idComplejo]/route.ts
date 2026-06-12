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

type Params = { idComplejo: string }

// Endpoint para obtener detalles de un complejo deportivo por ID
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<Params> }
) {
  const { idComplejo } = await params
  const id = parseInt(idComplejo)
  if (isNaN(id)) return errorJson('BAD_REQUEST', 'ID inválido', 400)

  const prisma = getPrisma()
  try {
    const complejo = await prisma.complejo.findUnique({ where: { id_complejo: id } })
    if (!complejo) return errorJson('NOT_FOUND', 'Complejo no encontrado', 404)
    return Response.json(complejo)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[GET /complejos/:id]', msg)
    return errorJson('INTERNAL_ERROR', 'Error interno del servidor', 500, msg)
  } finally {
    await prisma.$disconnect()
  }
}

// Endpoint para modificar un complejo deportivo (solo admin y solo si sos el administrador del complejo)
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<Params> }
) {
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

    let body: { nombre?: unknown; direccion?: unknown }
    try {
      body = await req.json()
    } catch {
      return errorJson('BAD_REQUEST', 'Body JSON inválido', 400)
    }

    const { nombre, direccion } = body
    const data: { nombre?: string; direccion?: string } = {}

    if (nombre !== undefined) {
      if (typeof nombre !== 'string' || nombre.trim() === '') {
        return errorJson('VALIDATION_ERROR', 'El nombre no puede estar vacío', 422)
      }
      if (nombre.length > 100) {
        return errorJson('VALIDATION_ERROR', 'El nombre no puede superar 100 caracteres', 422)
      }
      data.nombre = nombre.trim()
    }

    if (direccion !== undefined) {
      if (typeof direccion !== 'string' || direccion.trim() === '') {
        return errorJson('VALIDATION_ERROR', 'La dirección no puede estar vacía', 422)
      }
      if (direccion.length > 255) {
        return errorJson('VALIDATION_ERROR', 'La dirección no puede superar 255 caracteres', 422)
      }
      data.direccion = direccion.trim()
    }

    if (Object.keys(data).length === 0) {
      return errorJson('BAD_REQUEST', 'No se enviaron campos a modificar', 400)
    }

    const actualizado = await prisma.complejo.update({
      where: { id_complejo: id },
      data,
    })

    return Response.json(actualizado)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[PATCH /complejos/:id]', msg)
    return errorJson('INTERNAL_ERROR', 'Error interno del servidor', 500, msg)
  } finally {
    await prisma.$disconnect()
  }
}

// Endpoint para eliminar un complejo deportivo (solo admin y solo si sos el administrador del complejo)
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<Params> }
) {
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

    await prisma.complejo.delete({ where: { id_complejo: id } })

    return new Response(null, { status: 204 })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[DELETE /complejos/:id]', msg)
    return errorJson('INTERNAL_ERROR', 'Error interno del servidor', 500, msg)
  } finally {
    await prisma.$disconnect()
  }
}
