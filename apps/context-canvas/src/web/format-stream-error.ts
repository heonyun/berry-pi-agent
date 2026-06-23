const USAGE_LIMIT_MESSAGE =
  "AI 사용 한도에 도달했습니다. 잠시 후 다시 시도하거나 플랜을 확인하세요.";

function tryParseJsonPayload(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed.startsWith("{")) {
    return null;
  }
  try {
    const parsed = JSON.parse(trimmed) as {
      error?: { message?: string; type?: string };
      message?: string;
      type?: string;
    };
    if (parsed.error?.type === "usage_limit_reached" || parsed.type === "usage_limit_reached") {
      return USAGE_LIMIT_MESSAGE;
    }
    if (parsed.error?.message) {
      return parsed.error.message;
    }
    if (parsed.message) {
      return parsed.message;
    }
  } catch {
    return null;
  }
  return null;
}

/** WHY: stream/API errors arrive as raw JSON; users need a short readable message. */
export function formatStreamError(raw: string): string {
  const text = raw.trim();
  if (!text) {
    return "답변을 생성하지 못했습니다.";
  }

  if (text.includes("usage_limit_reached") || text.includes('"status_code":429')) {
    return USAGE_LIMIT_MESSAGE;
  }

  const codexPrefix = /^Codex error:\s*/i;
  if (codexPrefix.test(text)) {
    const body = text.replace(codexPrefix, "").trim();
    const fromJson = tryParseJsonPayload(body);
    if (fromJson) {
      return fromJson;
    }
  }

  const fromJson = tryParseJsonPayload(text);
  if (fromJson) {
    return fromJson;
  }

  const singleLine = text.replace(/\s+/g, " ");
  if (singleLine.length <= 120) {
    return singleLine;
  }
  return `${singleLine.slice(0, 117)}…`;
}
