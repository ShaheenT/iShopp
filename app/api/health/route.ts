import { NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET() {
  const startedAt = Date.now();

  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.SUPABASE_SERVICE_ROLE_KEY
  ) {
    return NextResponse.json(
      {
        status: "degraded",
        service: "ishopp-api",
        version: "0.1.0",
        database: "not-configured",
        latency_ms: Date.now() - startedAt,
      },
      { status: 503 },
    );
  }

  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("system_health")
      .select("service,status,updated_at")
      .eq("id", "ishopp-api")
      .maybeSingle();

    if (error) {
      return NextResponse.json(
        {
          status: "degraded",
          service: "ishopp-api",
          version: "0.1.0",
          database: "error",
          error: "database_health_check_failed",
          latency_ms: Date.now() - startedAt,
        },
        { status: 503 },
      );
    }

    if (!data) {
      return NextResponse.json(
        {
          status: "degraded",
          service: "ishopp-api",
          version: "0.1.0",
          database: "schema_not_initialized",
          latency_ms: Date.now() - startedAt,
        },
        { status: 503 },
      );
    }

    return NextResponse.json({
      status: "ok",
      service: data.service,
      version: "0.1.0",
      database: data.status === "ok" ? "connected" : data.status,
      database_updated_at: data.updated_at,
      latency_ms: Date.now() - startedAt,
    });
  } catch {
    return NextResponse.json(
      {
        status: "degraded",
        service: "ishopp-api",
        version: "0.1.0",
        database: "error",
        error: "database_health_check_failed",
        latency_ms: Date.now() - startedAt,
      },
      { status: 503 },
    );
  }
}
