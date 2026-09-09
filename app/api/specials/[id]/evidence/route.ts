import { NextResponse } from "next/server";
import { z } from "zod";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const evidenceSchema = z.object({
  sourceUrl: z.string().url().max(2048).optional(),
  sourceType: z.string().trim().min(1).max(100),
  sourceHash: z.string().trim().min(8).max(256).optional(),
  capturedAt: z.string().datetime().optional(),
  extractedText: z.string().max(500_000).optional(),
  extractedData: z.record(z.unknown()).optional(),
  storagePath: z.string().trim().min(1).max(1024).optional(),
}).refine((value) => Boolean(value.sourceUrl || value.storagePath), {
  message: "sourceUrl or storagePath is required",
  path: ["sourceUrl"],
});

async function isAuthorized(request: Request) {
  const configuredToken = process.env.ISHOPP_INGESTION_API_TOKEN;
  const suppliedToken = request.headers.get("x-ishopp-ingestion-token");

  if (configuredToken && suppliedToken && suppliedToken === configuredToken) {
    return true;
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user?.app_metadata?.role === "admin";
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  if (!(await isAuthorized(request))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  if (!z.string().uuid().safeParse(id).success) {
    return NextResponse.json({ error: "invalid_special_id" }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const parsed = evidenceSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_evidence", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const admin = createAdminClient();
  const { data: special, error: specialError } = await admin
    .from("specials")
    .select("id,verification_status")
    .eq("id", id)
    .maybeSingle();

  if (specialError) {
    console.error("special lookup failed", specialError);
    return NextResponse.json({ error: "special_unavailable" }, { status: 500 });
  }

  if (!special) {
    return NextResponse.json({ error: "special_not_found" }, { status: 404 });
  }

  if (special.verification_status === "verified") {
    return NextResponse.json({ error: "special_already_verified" }, { status: 409 });
  }

  const input = parsed.data;
  const { data, error } = await admin
    .from("special_evidence")
    .insert({
      special_id: id,
      source_url: input.sourceUrl ?? null,
      source_type: input.sourceType,
      source_hash: input.sourceHash ?? null,
      captured_at: input.capturedAt ?? new Date().toISOString(),
      extracted_text: input.extractedText ?? null,
      extracted_data: input.extractedData ?? null,
      storage_path: input.storagePath ?? null,
    })
    .select("id,special_id,source_type,source_hash,status,captured_at,created_at")
    .single();

  if (error) {
    console.error("special evidence ingestion failed", error);
    return NextResponse.json({ error: "evidence_ingestion_failed" }, { status: 500 });
  }

  return NextResponse.json({ data }, { status: 201 });
}
