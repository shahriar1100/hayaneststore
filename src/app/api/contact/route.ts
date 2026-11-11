import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/server/admin-auth";
import {
  createContactMessage,
  deleteContactMessage,
  getContactMessages,
  updateContactMessageStatus,
} from "@/lib/server/store-repository";

export async function GET() {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized admin session." }, { status: 401 });
  }
  const messages = await getContactMessages();
  return NextResponse.json({ messages });
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      name?: string;
      contact?: string;
      topic?: string;
      message?: string;
    };

    if (!body.name?.trim() || !body.contact?.trim() || !body.message?.trim()) {
      return NextResponse.json(
        { ok: false, error: "Please fill in your name, phone/email, and message." },
        { status: 400 },
      );
    }

    const record = await createContactMessage({
      name: body.name,
      contact: body.contact,
      topic: body.topic,
      message: body.message,
    });

    return NextResponse.json({ ok: true, message: record });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Failed to send message.";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized admin session." }, { status: 401 });
  }

  try {
    const body = (await request.json()) as {
      id?: string;
      status?: "unread" | "resolved";
    };
    if (!body.id || !body.status) {
      return NextResponse.json({ error: "Message ID and status are required." }, { status: 400 });
    }
    await updateContactMessageStatus(body.id, body.status);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Failed to update message.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized admin session." }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "Message ID is required." }, { status: 400 });
  }
  await deleteContactMessage(id);
  return NextResponse.json({ ok: true });
}
