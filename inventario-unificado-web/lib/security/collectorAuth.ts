import { timingSafeEqual } from "crypto";

function safeCompare(valueA: string, valueB: string) {
  const bufferA = Buffer.from(valueA);
  const bufferB = Buffer.from(valueB);

  if (bufferA.length !== bufferB.length) return false;
  return timingSafeEqual(bufferA, bufferB);
}

export function validateCollectorBearerToken(authorizationHeader: string | null) {
  const expectedToken = process.env.COLLECTOR_API_TOKEN?.trim();

  if (!expectedToken) {
    return {
      valid: false as const,
      error: "COLLECTOR_API_TOKEN não configurado no servidor."
    };
  }

  if (!authorizationHeader?.startsWith("Bearer ")) {
    return {
      valid: false as const,
      error: "Header Authorization inválido. Use Bearer <token>."
    };
  }

  const receivedToken = authorizationHeader.replace("Bearer ", "").trim();

  if (!safeCompare(receivedToken, expectedToken)) {
    return { valid: false as const, error: "Token do coletor inválido." };
  }

  return { valid: true as const };
}
