export class WorkspaceApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
    this.name = "WorkspaceApiError";
  }
}
export async function workspaceApi<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const response = await fetch(`/api${path}`, {
    ...init,
    credentials: "same-origin",
    headers: { "content-type": "application/json", ...init.headers },
  });
  const json = response.headers
    .get("content-type")
    ?.includes("application/json");
  const body = json ? await response.json().catch(() => null) : null;
  if (response.status === 401 && !path.startsWith("/auth/"))
    window.dispatchEvent(new Event("renova-session-expired"));
  if (!response.ok)
    throw new WorkspaceApiError(
      typeof body?.error === "string"
        ? body.error
        : `Unable to complete this request (${response.status}).`,
      response.status,
    );
  if (!json || body === null)
    throw new WorkspaceApiError(
      "The account service is unavailable. Please try again later.",
      502,
    );
  return body as T;
}
export const errorMessage = (cause: unknown) =>
  cause instanceof Error ? cause.message : "Unable to complete this request.";
