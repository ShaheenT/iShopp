import crypto from "node:crypto";

export type PayFastConfig = {
  merchantId: string;
  merchantKey: string;
  passphrase?: string;
  sandbox: boolean;
};

export function getPayFastConfig(): PayFastConfig | null {
  const merchantId = process.env.PAYFAST_MERCHANT_ID;
  const merchantKey = process.env.PAYFAST_MERCHANT_KEY;
  if (!merchantId || !merchantKey) return null;
  return { merchantId, merchantKey, passphrase: process.env.PAYFAST_PASSPHRASE, sandbox: process.env.PAYFAST_SANDBOX !== "false" };
}

export function payFastEndpoint(sandbox: boolean) {
  return sandbox ? "https://sandbox.payfast.co.za/eng/process" : "https://www.payfast.co.za/eng/process";
}

export function payFastSignature(data: Record<string, string>, passphrase?: string) {
  const pairs = Object.entries(data)
    .filter(([key]) => key !== "signature")
    .map(([key, value]) => `${key}=${encodeURIComponent(value).replace(/%20/g, "+")}`);
  let payload = pairs.join("&");
  if (passphrase) payload += `&passphrase=${encodeURIComponent(passphrase).replace(/%20/g, "+")}`;
  return crypto.createHash("md5").update(payload).digest("hex");
}

export function timingSafeEqualHex(a: string, b: string) {
  const aa = Buffer.from(a, "utf8");
  const bb = Buffer.from(b, "utf8");
  return aa.length === bb.length && crypto.timingSafeEqual(aa, bb);
}
