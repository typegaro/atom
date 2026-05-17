import { createHash, randomBytes } from "node:crypto";
import { createServer } from "node:http";

const AUTHORIZE_URL = "https://auth.openai.com/oauth/authorize";
const TOKEN_URL = "https://auth.openai.com/oauth/token";
const CLIENT_ID = "app_EMoamEEZ73f0CkXaXp7hrann";
const REDIRECT_URI = "http://localhost:1455/auth/callback";
const SCOPE = "openid profile email offline_access";
const JWT_CLAIM_PATH = "https://api.openai.com/auth";
const OAUTH_CALLBACK_HOST = process.env.ATOM_OAUTH_CALLBACK_HOST ?? "127.0.0.1";

export interface OpenAIResponsesCredentials {
  access: string;
  refresh: string;
  expires: number;
  accountId: string;
}

export interface OpenAIResponsesLoginOptions {
  onAuth(info: { url: string; instructions?: string }): void;
  onPrompt(message: string): Promise<string>;
  onProgress?(message: string): void;
}

function base64UrlEncode(buffer: Buffer): string {
  return buffer.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

async function generatePkce(): Promise<{ verifier: string; challenge: string }> {
  const verifier = base64UrlEncode(randomBytes(32));
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  return { verifier, challenge };
}

function createState(): string {
  return randomBytes(16).toString("hex");
}

function parseAuthorizationInput(input: string): { code?: string; state?: string } {
  const value = input.trim();

  if (!value) {
    return {};
  }

  try {
    const url = new URL(value);
    return {
      code: url.searchParams.get("code") ?? undefined,
      state: url.searchParams.get("state") ?? undefined
    };
  } catch {
    // Fall through to other supported pasted formats.
  }

  if (value.includes("#")) {
    const [code, state] = value.split("#", 2);
    return { code, state };
  }

  if (value.includes("code=")) {
    const params = new URLSearchParams(value);
    return {
      code: params.get("code") ?? undefined,
      state: params.get("state") ?? undefined
    };
  }

  return { code: value };
}

function decodeJwt(token: string): Record<string, unknown> | undefined {
  try {
    const payload = token.split(".")[1];
    if (!payload) {
      return undefined;
    }

    return JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as Record<string, unknown>;
  } catch {
    return undefined;
  }
}

export function extractOpenAIResponsesAccountId(accessToken: string): string {
  const payload = decodeJwt(accessToken);
  const auth = payload?.[JWT_CLAIM_PATH];

  if (!auth || typeof auth !== "object") {
    throw new Error("Failed to extract accountId from token");
  }

  const accountId = (auth as { chatgpt_account_id?: unknown }).chatgpt_account_id;
  if (typeof accountId !== "string" || accountId.length === 0) {
    throw new Error("Failed to extract accountId from token");
  }

  return accountId;
}

async function exchangeAuthorizationCode(code: string, verifier: string): Promise<OpenAIResponsesCredentials> {
  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      client_id: CLIENT_ID,
      code,
      code_verifier: verifier,
      redirect_uri: REDIRECT_URI
    })
  });

  if (!response.ok) {
    throw new Error(`Token exchange failed: ${response.status}`);
  }

  const json = await response.json() as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
  };

  if (!json.access_token || !json.refresh_token || typeof json.expires_in !== "number") {
    throw new Error("Token exchange returned incomplete credentials");
  }

  return {
    access: json.access_token,
    refresh: json.refresh_token,
    expires: Date.now() + (json.expires_in * 1000),
    accountId: extractOpenAIResponsesAccountId(json.access_token)
  };
}

export async function refreshOpenAIResponsesToken(refreshToken: string): Promise<OpenAIResponsesCredentials> {
  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      client_id: CLIENT_ID
    })
  });

  if (!response.ok) {
    throw new Error(`Token refresh failed: ${response.status}`);
  }

  const json = await response.json() as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
  };

  if (!json.access_token || !json.refresh_token || typeof json.expires_in !== "number") {
    throw new Error("Token refresh returned incomplete credentials");
  }

  return {
    access: json.access_token,
    refresh: json.refresh_token,
    expires: Date.now() + (json.expires_in * 1000),
    accountId: extractOpenAIResponsesAccountId(json.access_token)
  };
}

async function createAuthorizationFlow(): Promise<{ verifier: string; state: string; url: string }> {
  const { verifier, challenge } = await generatePkce();
  const state = createState();
  const url = new URL(AUTHORIZE_URL);

  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", CLIENT_ID);
  url.searchParams.set("redirect_uri", REDIRECT_URI);
  url.searchParams.set("scope", SCOPE);
  url.searchParams.set("code_challenge", challenge);
  url.searchParams.set("code_challenge_method", "S256");
  url.searchParams.set("state", state);
  url.searchParams.set("id_token_add_organizations", "true");
  url.searchParams.set("codex_cli_simplified_flow", "true");
  url.searchParams.set("originator", "atom");

  return { verifier, state, url: url.toString() };
}

async function waitForAuthorizationCode(state: string): Promise<{ wait(): Promise<string | undefined>; stop(): void }> {
  let settle: ((code?: string) => void) | undefined;
  const codePromise = new Promise<string | undefined>((resolve) => {
    settle = resolve;
  });

  const server = createServer((req, res) => {
    try {
      const url = new URL(req.url ?? "", "http://localhost");
      const returnedState = url.searchParams.get("state");
      const code = url.searchParams.get("code");

      if (url.pathname !== "/auth/callback" || returnedState !== state || !code) {
        res.writeHead(400, { "Content-Type": "text/html; charset=utf-8" });
        res.end("<html><body><h1>OAuth failed</h1><p>Invalid callback payload.</p></body></html>");
        return;
      }

      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end("<html><body><h1>Atom login complete</h1><p>You can close this window.</p></body></html>");
      settle?.(code);
    } catch {
      res.writeHead(500, { "Content-Type": "text/html; charset=utf-8" });
      res.end("<html><body><h1>OAuth failed</h1><p>Internal callback error.</p></body></html>");
    }
  });

  await new Promise<void>((resolve) => {
    server.listen(1455, OAUTH_CALLBACK_HOST, () => resolve());
    server.on("error", () => resolve());
  });

  return {
    stop() {
      settle?.(undefined);
      server.close();
    },
    async wait() {
      return await codePromise;
    }
  };
}

export async function loginOpenAIResponses(options: OpenAIResponsesLoginOptions): Promise<OpenAIResponsesCredentials> {
  const { verifier, state, url } = await createAuthorizationFlow();
  const waiter = await waitForAuthorizationCode(state);

  options.onAuth({ url, instructions: "Complete login in the browser, or paste the redirect URL/code here." });

  try {
    const browserCodePromise = waiter.wait();
    const pastedInput = await Promise.race([
      browserCodePromise,
      options.onPrompt("Paste the authorization code (or full redirect URL):")
    ]);

    let code = typeof pastedInput === "string" ? pastedInput : undefined;

    if (code && code !== await browserCodePromise.catch(() => undefined)) {
      const parsed = parseAuthorizationInput(code);
      if (parsed.state && parsed.state !== state) {
        throw new Error("State mismatch");
      }
      code = parsed.code;
    }

    if (!code) {
      code = await browserCodePromise;
    }

    if (!code) {
      throw new Error("Missing authorization code");
    }

    options.onProgress?.("Exchanging authorization code...");
    return await exchangeAuthorizationCode(code, verifier);
  } finally {
    waiter.stop();
  }
}

export type OpenAICodexCredentials = OpenAIResponsesCredentials;
export type OpenAICodexLoginOptions = OpenAIResponsesLoginOptions;
export const extractOpenAICodexAccountId = extractOpenAIResponsesAccountId;
export const refreshOpenAICodexToken = refreshOpenAIResponsesToken;
export const loginOpenAICodex = loginOpenAIResponses;
