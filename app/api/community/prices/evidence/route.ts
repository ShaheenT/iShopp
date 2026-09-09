import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";

const MAX_BYTES = 8 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"]);

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: userData, error: userError } = await supabase.auth.getUser();

  if (userError || !userData.user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const formData = await request.formData().catch(() => null);
  const file = formData?.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "evidence_file_required" }, { status: 400 });
  }

  if (!ALLOWED_TYPES.has(file.type)) {
    return NextResponse.json({ error: "unsupported_evidence_type" }, { status: 400 });
  }

  if (file.size <= 0 || file.size > MAX_BYTES) {
    return NextResponse.json({ error: "evidence_file_too_large" }, { status: 400 });
  }

  const extension = file.name.includes(".") ? file.name.split(".").pop()?.toLowerCase() : "jpg";
  const objectPath = `${userData.user.id}/${crypto.randomUUID()}.${extension || "jpg"}`;

  const { error: uploadError } = await supabase.storage
    .from("community-price-evidence")
    .upload(objectPath, file, {
      contentType: file.type,
      upsert: false,
      cacheControl: "3600",
    });

  if (uploadError) {
    console.error("community price evidence upload failed", uploadError);
    return NextResponse.json({ error: "evidence_upload_failed" }, { status: 400 });
  }

  return NextResponse.json(
    {
      data: {
        storagePath: objectPath,
        mimeType: file.type,
        size: file.size,
      },
    },
    { status: 201 },
  );
}
