import { get, set } from 'idb-keyval';

// -------------------------------------------------------------
// Operator identity — persistent ECDSA P-256 keypair.
//
// Private key is stored in IndexedDB as a *non-extractable*
// CryptoKey. It never leaves the browser. Public key is stored
// as JWK and also as a raw SPKI export used to compute the
// stable fingerprint that appears in the header.
// -------------------------------------------------------------

const IDB_KEY_PRIV = 'uranus:operator:privkey';
const IDB_KEY_PUB_JWK = 'uranus:operator:pubkey:jwk';
const IDB_KEY_FINGERPRINT = 'uranus:operator:fingerprint';

export interface OperatorIdentity {
  privateKey: CryptoKey;
  publicKey: CryptoKey;
  publicJwk: JsonWebKey;
  fingerprint: string; // hex, first 32 chars of SHA-256(SPKI)
}

let cachedIdentity: OperatorIdentity | null = null;

async function computeFingerprint(publicKey: CryptoKey): Promise<string> {
  const spki = await window.crypto.subtle.exportKey('spki', publicKey);
  const digest = await window.crypto.subtle.digest('SHA-256', spki);
  const bytes = Array.from(new Uint8Array(digest));
  return bytes.map((b) => b.toString(16).padStart(2, '0')).join('').slice(0, 32);
}

export async function getOrCreateOperatorIdentity(): Promise<OperatorIdentity> {
  if (cachedIdentity) return cachedIdentity;

  const existingPriv = await get<CryptoKey>(IDB_KEY_PRIV);
  const existingJwk = await get<JsonWebKey>(IDB_KEY_PUB_JWK);

  if (existingPriv && existingJwk) {
    const publicKey = await window.crypto.subtle.importKey(
      'jwk',
      existingJwk,
      { name: 'ECDSA', namedCurve: 'P-256' },
      true,
      ['verify'],
    );
    const fingerprint =
      (await get<string>(IDB_KEY_FINGERPRINT)) ?? (await computeFingerprint(publicKey));
    await set(IDB_KEY_FINGERPRINT, fingerprint);
    cachedIdentity = {
      privateKey: existingPriv,
      publicKey,
      publicJwk: existingJwk,
      fingerprint,
    };
    return cachedIdentity;
  }

  const keypair = await window.crypto.subtle.generateKey(
    { name: 'ECDSA', namedCurve: 'P-256' },
    false, // non-extractable private key
    ['sign', 'verify'],
  );

  // Re-export the public half as JWK (public keys are always extractable)
  const publicJwk = await window.crypto.subtle.exportKey('jwk', keypair.publicKey);
  const fingerprint = await computeFingerprint(keypair.publicKey);

  await set(IDB_KEY_PRIV, keypair.privateKey);
  await set(IDB_KEY_PUB_JWK, publicJwk);
  await set(IDB_KEY_FINGERPRINT, fingerprint);

  cachedIdentity = {
    privateKey: keypair.privateKey,
    publicKey: keypair.publicKey,
    publicJwk,
    fingerprint,
  };
  return cachedIdentity;
}

export async function signAuthorization(
  identity: OperatorIdentity,
  payload: {
    payload_hash: string;
    amount: number;
    timestamp: number;
    decision: string;
  },
): Promise<string> {
  const canonical = canonicalizeSignPayload({
    ...payload,
    operator_fingerprint: identity.fingerprint,
  });
  const bytes = new TextEncoder().encode(canonical);
  const sig = await window.crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    identity.privateKey,
    bytes,
  );
  return bytesToBase64(new Uint8Array(sig));
}

export async function verifyAuthorization(
  publicJwk: JsonWebKey,
  payload: {
    payload_hash: string;
    amount: number;
    timestamp: number;
    decision: string;
    operator_fingerprint: string;
  },
  signatureBase64: string,
): Promise<boolean> {
  const key = await getCryptoSubtle().importKey(
    'jwk',
    publicJwk,
    { name: 'ECDSA', namedCurve: 'P-256' },
    true,
    ['verify'],
  );
  const canonical = canonicalizeSignPayload(payload);
  const bytes = new TextEncoder().encode(canonical);
  const sig = base64ToBytes(signatureBase64);
  return getCryptoSubtle().verify(
    { name: 'ECDSA', hash: 'SHA-256' },
    key,
    sig as BufferSource,
    bytes as BufferSource,
  );
}

export async function computeFingerprintFromJwk(publicJwk: JsonWebKey): Promise<string> {
  const key = await getCryptoSubtle().importKey(
    'jwk',
    publicJwk,
    { name: 'ECDSA', namedCurve: 'P-256' },
    true,
    ['verify'],
  );
  const spki = await getCryptoSubtle().exportKey('spki', key);
  const digest = await getCryptoSubtle().digest('SHA-256', spki);
  const bytes = Array.from(new Uint8Array(digest));
  return bytes.map((b) => b.toString(16).padStart(2, '0')).join('').slice(0, 32);
}

function canonicalizeSignPayload(obj: Record<string, unknown>): string {
  const sortedKeys = Object.keys(obj).sort();
  return JSON.stringify(sortedKeys.reduce<Record<string, unknown>>((acc, k) => {
    acc[k] = obj[k];
    return acc;
  }, {}));
}

// -------------------------------------------------------------
// SHA-256 helpers usable in both browser and Node.
// -------------------------------------------------------------
export async function sha256Hex(input: string | Uint8Array): Promise<string> {
  const bytes = typeof input === 'string' ? new TextEncoder().encode(input) : input;
  const digest = await getCryptoSubtle().digest('SHA-256', bytes as BufferSource);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export async function payloadHash(payload: unknown): Promise<string> {
  const canonical = canonicalize(payload);
  const hex = await sha256Hex(canonical);
  return '0x' + hex.slice(0, 40);
}

function canonicalize(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return '[' + value.map(canonicalize).join(',') + ']';
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return (
    '{' + keys.map((k) => JSON.stringify(k) + ':' + canonicalize(obj[k])).join(',') + '}'
  );
}

// -------------------------------------------------------------
// Base64 helpers — browser (btoa/atob) & Node (Buffer) both work.
// -------------------------------------------------------------
export function bytesToBase64(bytes: Uint8Array): string {
  if (typeof btoa !== 'undefined') {
    let s = '';
    for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
    return btoa(s);
  }
  return Buffer.from(bytes).toString('base64');
}

export function base64ToBytes(str: string): Uint8Array {
  if (typeof atob !== 'undefined') {
    const bin = atob(str);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }
  return new Uint8Array(Buffer.from(str, 'base64'));
}

function getCryptoSubtle(): SubtleCrypto {
  if (typeof globalThis.crypto !== 'undefined' && globalThis.crypto.subtle) {
    return globalThis.crypto.subtle;
  }
  throw new Error('Web Crypto (SubtleCrypto) not available in this environment');
}

export function generateTxHash(): string {
  const rand = new Uint8Array(20);
  getCryptoRandom(rand);
  return '0x' + Array.from(rand).map((b) => b.toString(16).padStart(2, '0')).join('');
}

export function generateRequestId(): string {
  const rand = new Uint8Array(6);
  getCryptoRandom(rand);
  return 'req_' + Array.from(rand).map((b) => b.toString(16).padStart(2, '0')).join('');
}

export function generateIdempotencyKey(): string {
  const rand = new Uint8Array(8);
  getCryptoRandom(rand);
  return 'idm_' + Array.from(rand).map((b) => b.toString(16).padStart(2, '0')).join('');
}

function getCryptoRandom(out: Uint8Array): void {
  if (typeof globalThis.crypto !== 'undefined' && globalThis.crypto.getRandomValues) {
    globalThis.crypto.getRandomValues(out);
    return;
  }
  throw new Error('crypto.getRandomValues not available');
}
