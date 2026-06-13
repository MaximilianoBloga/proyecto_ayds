import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { NextRequest } from 'next/server'

function getPrisma() {
  const url = process.env.DATABASE_URL
  if (!url) throw new Error('DATABASE_URL no configurado')
  return new PrismaClient({ adapter: new PrismaPg(url) })
}

function formatTime(val: Date | string | unknown): string {
  if (val instanceof Date) return val.toISOString().substring(11, 16)
  return String(val).substring(0, 5)
}

type Params = { idCancha: string }

// Público — no requiere auth. Devuelve las horas ocupadas (Pendiente|Pagada) para cancha+fecha.
export async function GET(req: NextRequest, { params }: { params: Promise<Params> }) {
  const { idCancha } = await params
  const id = parseInt(idCancha)
  if (isNaN(id)) {
    return Response.json({ error: { code: 'BAD_REQUEST', message: 'ID inválido' } }, { status: 400 })
  }

  const fechaParam = req.nextUrl.searchParams.get('fecha')
  if (!fechaParam) {
    return Response.json({ error: { code: 'BAD_REQUEST', message: 'El parámetro fecha es requerido (YYYY-MM-DD)' } }, { status: 400 })
  }

  const fechaDate = new Date(`${fechaParam.substring(0, 10)}T00:00:00.000Z`)
  if (isNaN(fechaDate.getTime())) {
    return Response.json({ error: { code: 'BAD_REQUEST', message: 'Formato de fecha inválido' } }, { status: 400 })
  }

  const prisma = getPrisma()
  try {
    const reservas = await prisma.reserva.findMany({
      where: {
        id_cancha: id,
        fecha: fechaDate,
        estado: { in: ['Pendiente', 'Pagada'] },
      },
      select: { hora: true },
    })

    const horasOcupadas = reservas.map((r) => formatTime(r.hora))

    return Response.json({ horasOcupadas })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[GET /canchas/:id/disponibilidad]', msg)
    return Response.json({ error: { code: 'INTERNAL_ERROR', message: 'Error interno' } }, { status: 500 })
  } finally {
    await prisma.$disconnect()
  }
}
