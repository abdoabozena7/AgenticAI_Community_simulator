import { beforeEach, describe, expect, it, vi } from "vitest";

import { apiService } from "@/services/api";

const encodeBase64Url = (value: string) =>
  btoa(value).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");

const makeToken = (exp: number) => {
  const header = encodeBase64Url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const payload = encodeBase64Url(JSON.stringify({ exp }));
  return `${header}.${payload}.signature`;
};

describe("apiService auth refresh behavior", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it("refreshes an expiring token before protected requests", async () => {
    const expiredToken = makeToken(Math.floor(Date.now() / 1000) - 60);
    const freshToken = makeToken(Math.floor(Date.now() / 1000) + 3600);
    localStorage.setItem("agentic_access_token", expiredToken);
    localStorage.setItem("agentic_refresh_token", "refresh-token");

    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith("/auth/refresh")) {
        return new Response(
          JSON.stringify({
            access_token: freshToken,
            refresh_token: "refresh-token-2",
            token_type: "bearer",
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }
      if (url.endsWith("/auth/me")) {
        return new Response(
          JSON.stringify({ id: 5, username: "user", role: "user" }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }
      throw new Error(`Unexpected fetch to ${url}`);
    });

    vi.stubGlobal("fetch", fetchMock);

    const me = await apiService.getMe();

    expect(me).toMatchObject({ id: 5, username: "user", role: "user" });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain("/auth/refresh");
    expect(String(fetchMock.mock.calls[1]?.[0])).toContain("/auth/me");
    expect(localStorage.getItem("agentic_access_token")).toBe(freshToken);
    expect(localStorage.getItem("agentic_refresh_token")).toBe("refresh-token-2");
  });
});
