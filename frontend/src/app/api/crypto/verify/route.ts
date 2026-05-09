import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifySessionToken, COOKIE_NAME } from "@/lib/auth";
import { updateUserPlan } from "@/lib/db";
import { sendProConfirmationEmail, notifyAdminProUpgrade } from "@/lib/email";

export const runtime = "nodejs";

const ETH_RPC = "https://eth.llamarpc.com";

async function rpcCall(method: string, params: unknown[]) {
  const resp = await fetch(ETH_RPC, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
    signal: AbortSignal.timeout(15000),
  });
  return (await resp.json()).result;
}

export async function POST(req: NextRequest) {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await verifySessionToken(token);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const ethAddress = process.env.NEXT_PUBLIC_ETH_PAYMENT_ADDRESS;
  if (!ethAddress) {
    return NextResponse.json({ error: "Crypto payments not configured" }, { status: 503 });
  }

  const { txHash, expectedEth } = await req.json() as { txHash: string; expectedEth: number };
  if (!txHash || typeof expectedEth !== "number") {
    return NextResponse.json({ error: "Missing txHash or expectedEth" }, { status: 400 });
  }

  try {
    const receipt = await rpcCall("eth_getTransactionReceipt", [txHash]);
    if (!receipt) {
      return NextResponse.json({ error: "Transaction not found — may still be pending" }, { status: 400 });
    }
    if (receipt.status !== "0x1") {
      return NextResponse.json({ error: "Transaction failed on-chain" }, { status: 400 });
    }
    if (receipt.to?.toLowerCase() !== ethAddress.toLowerCase()) {
      return NextResponse.json({ error: "Transaction sent to wrong address" }, { status: 400 });
    }

    const tx = await rpcCall("eth_getTransactionByHash", [txHash]);
    if (!tx) {
      return NextResponse.json({ error: "Transaction data not found" }, { status: 400 });
    }

    const valueSentWei = BigInt(tx.value);
    // Allow 2% slippage for ETH price fluctuation
    const minValueWei = BigInt(Math.round(expectedEth * 0.98 * 1e15)) * BigInt(1000);
    if (valueSentWei < minValueWei) {
      return NextResponse.json({ error: "Insufficient payment amount" }, { status: 400 });
    }

    await updateUserPlan(user.id, "pro");
    void sendProConfirmationEmail(user.email, user.name);
    void notifyAdminProUpgrade(user.email, user.name, "crypto");
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Failed to verify transaction" }, { status: 500 });
  }
}
