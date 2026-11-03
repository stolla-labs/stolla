import { NextResponse } from "next/server";
import { evaluateDeploymentHealth } from "@/lib/health";
import { activeCapabilities } from "@/lib/stellar";

export const dynamic = "force-dynamic";

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0",
  Pragma: "no-cache",
  Expires: "0",
} as const;

export async function GET() {
  const { response, statusCode } = await evaluateDeploymentHealth(activeCapabilities);
  return NextResponse.json(response, {
    status: statusCode,
    headers: NO_STORE_HEADERS,
  });
}
