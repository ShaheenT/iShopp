import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    status: "ok",
    service: "ishopp-api",
    version: "0.1.0",
    database: "not-configured",
  });
}
