import type { AssistantMessage } from "@earendil-works/pi-ai";

export function assistantMessageText(message: AssistantMessage): string {
  return message.content
    .filter((entry): entry is Extract<(typeof message.content)[number], { type: "text" }> => entry.type === "text")
    .map((entry) => entry.text)
    .join("");
}

export function assistantRunErrorMessage(message: AssistantMessage): string | undefined {
  if (message.errorMessage) {
    return message.errorMessage;
  }
  if (message.stopReason === "error") {
    return "Agent run failed before producing an answer.";
  }
  if (message.stopReason === "aborted") {
    return "Agent run was aborted.";
  }
  return undefined;
}

export function findAssistantRunError(
  messages: Array<{ role: string; errorMessage?: string; stopReason?: string }>,
): string | undefined {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (message?.role !== "assistant") {
      continue;
    }
    const error = assistantRunErrorMessage(message as AssistantMessage);
    if (error) {
      return error;
    }
  }
  return undefined;
}
