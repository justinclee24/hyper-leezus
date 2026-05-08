import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/session";
import { updateTrackedBetResult, deleteTrackedBet } from "@/lib/db";
import type { TrackedBet } from "@/lib/data";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const { result } = await req.json();
  await updateTrackedBetResult(user.id, id, result as TrackedBet["result"]);
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  await deleteTrackedBet(user.id, id);
  return NextResponse.json({ ok: true });
}
