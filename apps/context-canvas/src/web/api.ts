export function buildPromptRequestHeaders(token: string | undefined): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (token) {
    headers["X-Context-Canvas-Token"] = token;
  }
  return headers;
}
