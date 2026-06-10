import { headers } from 'next/headers';
import { Webhook } from 'svix';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

type ClerkUserEvent = {
  type: 'user.created' | 'user.updated' | 'user.deleted';
  data: {
    id: string;
    email_addresses: { email_address: string; id: string }[];
    primary_email_address_id: string;
    first_name: string | null;
    last_name: string | null;
  };
};

function getPrisma() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL no configurado');
  const adapter = new PrismaPg(url);
  return new PrismaClient({ adapter });
}

export async function POST(req: Request) {
  const webhookSecret = process.env.CLERK_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.error('[webhook/clerk] CLERK_WEBHOOK_SECRET no configurado');
    return new Response('CLERK_WEBHOOK_SECRET no configurado', { status: 500 });
  }

  const headerPayload = await headers();
  const svixId = headerPayload.get('svix-id');
  const svixTimestamp = headerPayload.get('svix-timestamp');
  const svixSignature = headerPayload.get('svix-signature');

  if (!svixId || !svixTimestamp || !svixSignature) {
    return new Response('Headers de svix faltantes', { status: 400 });
  }

  const payload = await req.json();
  const body = JSON.stringify(payload);

  const wh = new Webhook(webhookSecret);
  let event: ClerkUserEvent;

  try {
    event = wh.verify(body, {
      'svix-id': svixId,
      'svix-timestamp': svixTimestamp,
      'svix-signature': svixSignature,
    }) as ClerkUserEvent;
  } catch (err) {
    console.error('[webhook/clerk] Firma inválida:', err);
    return new Response('Firma de webhook inválida', { status: 400 });
  }

  const { type, data } = event;

  try {
    const prisma = getPrisma();

    if (type === 'user.created') {
      const emailObj = data.email_addresses.find(
        (e) => e.id === data.primary_email_address_id
      );
      const email = emailObj?.email_address;
      if (!email) {
        return new Response('Email primario no encontrado', { status: 400 });
      }

      const nombre =
        [data.first_name, data.last_name].filter(Boolean).join(' ').trim() || email;

      await prisma.usuario.create({
        data: {
          email,
          nombre,
          telefono: '12345678',
          rol: 'cliente',
          clerk_user_id: data.id,
          cliente: {
            create: { buscando: false },
          },
        },
      });

      console.log('[webhook/clerk] Usuario creado:', email);
    }

    if (type === 'user.updated') {
      const nombre =
        [data.first_name, data.last_name].filter(Boolean).join(' ').trim();

      if (nombre) {
        await prisma.usuario.updateMany({
          where: { clerk_user_id: data.id },
          data: { nombre },
        });
      }
    }

    if (type === 'user.deleted') {
      await prisma.usuario.deleteMany({
        where: { clerk_user_id: data.id },
      });
    }

    await prisma.$disconnect();
  } catch (err) {
    const mensaje = err instanceof Error ? err.message : String(err);
    console.error('[webhook/clerk] Error en DB:', mensaje);
    return new Response(`Error interno: ${mensaje}`, { status: 500 });
  }

  return new Response('OK', { status: 200 });
}
