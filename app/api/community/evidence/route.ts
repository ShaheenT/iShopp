import { NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

function matchesSignature(type: string, bytes: Uint8Array): boolean {
  const startsWith = (signature: number[]) => signature.every((value, index) => bytes[index] === value);
  if (type === "image/jpeg") return startsWith([0xff, 0xd8, 0xff]);
  if (type === "image/png") return startsWith([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  if (type === "image/webp") {
    return startsWith([0x52, 0x49, 0x46, 0x46]) &&
      bytes.length >= 12 && bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50;
  }
  return false;
}

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
    return NextResponse.json({ error: "unsupported_evidence_type" }, { status: 415 });
  }

  if (file.size <= 0 || file.size > MAX_FILE_SIZE) {
    return NextResponse.json({ error: "evidence_file_too_large" }, { status: 413 });
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  if (!matchesSignature(file.type, bytes)) {
    return NextResponse.json({ error: "evidence_signature_mismatch" }, { status: 415 });
  }

  const digest = await crypto.subtle.digest("SHA-256", bytes);
  const sourceHash = Array.from(new Uint8Array(digest))
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("");

  const path = `${userData.user.id}/${crypto.randomUUID()}.${EXTENSIONS[file.type]}`;
  const admin = createAdminClient();
  const { error: uploadError } = await admin.storage
    .from("community-price-evidence")
    .upload(path, bytes, {
      contentType: file.type,
      cacheControl: "31536000",
      upsert: false,
    });

  if (uploadError) {
    console.error("community evidence upload failed", uploadError);
    return NextResponse.json({ error: "evidence_upload_failed" }, { status: 500 });
  }

  return NextResponse.json({
    data: {
      storagePath: path,
      sourceHash,
      contentType: file.type,
      size: file.size,
    },
  }, { status: 201 });
}
