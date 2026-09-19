const MAX_BODY_BYTES = 4_096;
const MAX_NAME_LENGTH = 120;
const MAX_EMAIL_LENGTH = 254;
const MAX_WEBSITE_LENGTH = 256;
const RATE_LIMIT_MAX_ATTEMPTS = 5;
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1_000;
const CONSENT_VERSION = "commercial-waitlist-v1";

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Cache-Control": "no-store",
      "Content-Type": "application/json; charset=utf-8",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

function failure(error, status) {
  return json({ ok: false, error }, status);
}

function isLocalOrigin(url) {
  return url.protocol === "http:" && (url.hostname === "localhost" || url.hostname === "127.0.0.1");
}

function hasAllowedOrigin(request) {
  if (request.headers.get("Sec-Fetch-Site") === "cross-site") {
    return false;
  }

  const origin = request.headers.get("Origin");
  if (!origin) {
    return true;
  }

  try {
    const requestUrl = new URL(request.url);
    const originUrl = new URL(origin);
    return originUrl.origin === requestUrl.origin || (isLocalOrigin(originUrl) && isLocalOrigin(requestUrl));
  } catch {
    return false;
  }
}

function hasJsonContentType(request) {
  const contentType = request.headers.get("Content-Type");
  return contentType?.split(";", 1)[0].trim().toLowerCase() === "application/json";
}

function hasValidContentLength(request) {
  const contentLength = request.headers.get("Content-Length");
  if (contentLength === null) {
    return true;
  }

  return /^\d+$/.test(contentLength) && Number(contentLength) <= MAX_BODY_BYTES;
}

async function readJson(request) {
  if (!request.body) {
    throw new Error("empty-body");
  }

  const reader = request.body.getReader();
  const chunks = [];
  let total = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }

    total += value.byteLength;
    if (total > MAX_BODY_BYTES) {
      await reader.cancel();
      throw new Error("body-too-large");
    }
    chunks.push(value);
  }

  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return JSON.parse(new TextDecoder().decode(bytes));
}

function isValidEmail(email) {
  if (email.length === 0 || email.length > MAX_EMAIL_LENGTH || /\s/.test(email)) {
    return false;
  }

  const parts = email.split("@");
  if (parts.length !== 2) {
    return false;
  }

  const [local, domain] = parts;
  if (
    local.length === 0 ||
    local.length > 64 ||
    local.startsWith(".") ||
    local.endsWith(".") ||
    local.includes("..") ||
    !/^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+$/i.test(local)
  ) {
    return false;
  }

  const labels = domain.split(".");
  return labels.length >= 2 && labels.at(-1).length >= 2 && labels.every((label) => /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i.test(label));
}

function validatePayload(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return { error: "Submitted data is invalid." };
  }

  if (payload.source !== "landing" || typeof payload.email !== "string") {
    return { error: "Submitted data is invalid." };
  }

  if (payload.name !== undefined && typeof payload.name !== "string") {
    return { error: "Name is invalid." };
  }

  if (payload.website !== undefined && typeof payload.website !== "string") {
    return { error: "Submitted data is invalid." };
  }

  const name = payload.name?.trim() ?? "";
  const email = payload.email.trim().toLowerCase();
  const website = payload.website?.trim() ?? "";
  if (name.length > MAX_NAME_LENGTH || website.length > MAX_WEBSITE_LENGTH) {
    return { error: "Submitted data is too large." };
  }

  if (!isValidEmail(email)) {
    return { error: "Enter a valid email address." };
  }

  return { name: name || null, email, website };
}

async function hashBucket(ipAddress, now) {
  const window = Math.floor(now / RATE_LIMIT_WINDOW_MS);
  const day = new Date(now).toISOString().slice(0, 10);
  const input = new TextEncoder().encode(`${day}:${window}:${ipAddress}`);
  const digest = await crypto.subtle.digest("SHA-256", input);
  return [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, "0")).join("");
}

async function isRateLimited(database, ipAddress, now) {
  const bucketHash = await hashBucket(ipAddress, now);
  const windowEndsAt = Math.floor(now / RATE_LIMIT_WINDOW_MS + 1) * RATE_LIMIT_WINDOW_MS;
  await database.prepare("DELETE FROM waitlist_rate_limits WHERE window_ends_at < ?").bind(now).run();
  const row = await database
    .prepare("INSERT INTO waitlist_rate_limits (bucket_hash, window_ends_at, attempts) VALUES (?, ?, 1) ON CONFLICT(bucket_hash) DO UPDATE SET attempts = attempts + 1, window_ends_at = excluded.window_ends_at RETURNING attempts")
    .bind(bucketHash, windowEndsAt)
    .first();
  return Number(row?.attempts) > RATE_LIMIT_MAX_ATTEMPTS;
}

async function submitWaitlist({ request, env }) {
  if (!hasAllowedOrigin(request)) {
    return failure("This request origin is not allowed.", 403);
  }

  if (!hasJsonContentType(request)) {
    return failure("Send data as JSON.", 415);
  }

  if (!hasValidContentLength(request)) {
    return failure("Submitted data is too large.", 413);
  }

  let payload;
  try {
    payload = await readJson(request);
  } catch (error) {
    return failure(error.message === "body-too-large" ? "Submitted data is too large." : "Submitted data is invalid.", error.message === "body-too-large" ? 413 : 400);
  }

  const input = validatePayload(payload);
  if (input.error) {
    return failure(input.error, 400);
  }

  if (input.website) {
    return json({ ok: true });
  }

  try {
    const now = Date.now();
    const ipAddress = request.headers.get("CF-Connecting-IP") ?? "";
    if (await isRateLimited(env.DB, ipAddress, now)) {
      return failure("Please try again later.", 429);
    }

    await env.DB
      .prepare("INSERT INTO waitlist_entries (name, email, created_at, source, consent_version) VALUES (?, ?, ?, ?, ?) ON CONFLICT(email) DO NOTHING")
      .bind(input.name, input.email, new Date(now).toISOString(), "landing", CONSENT_VERSION)
      .run();
    return json({ ok: true });
  } catch (error) {
    return failure("We could not join the waitlist right now. Please try again later.", 500);
  }
}

export async function onRequest(context) {
  if (context.request.method !== "POST") {
    return failure("Method not allowed.", 405);
  }
  return submitWaitlist(context);
}
