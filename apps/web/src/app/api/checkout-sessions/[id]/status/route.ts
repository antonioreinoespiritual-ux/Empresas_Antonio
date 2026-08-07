import { NextResponse } from "next/server";
import { commerce } from "@/lib/commerce";

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const order = await commerce.orders.findByCheckoutSessionId(params.id);
  return NextResponse.json({ status: order?.status ?? "PENDING" });
}
