import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/server/admin-auth";
import { fetchPathaoStores } from "@/lib/server/courier";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const res = await fetchPathaoStores();
  return NextResponse.json(res, { status: res.ok ? 200 : 400 });
}

export async function POST(request: Request) {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = (await request.json().catch(() => ({}))) as {
      pathaoClientId?: string;
      pathaoClientSecret?: string;
      pathaoUsername?: string;
      pathaoPassword?: string;
      testMode?: boolean;
    };

    const res = await fetchPathaoStores({
      ...(body.pathaoClientId !== undefined ? { pathaoClientId: body.pathaoClientId } : {}),
      ...(body.pathaoClientSecret !== undefined
        ? { pathaoClientSecret: body.pathaoClientSecret }
        : {}),
      ...(body.pathaoUsername !== undefined ? { pathaoUsername: body.pathaoUsername } : {}),
      ...(body.pathaoPassword !== undefined ? { pathaoPassword: body.pathaoPassword } : {}),
      ...(body.testMode !== undefined ? { testMode: Boolean(body.testMode) } : {}),
    });

    return NextResponse.json(res, { status: res.ok ? 200 : 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to query Pathao stores.";
    return NextResponse.json({ ok: false, message }, { status: 500 });
  }
}
