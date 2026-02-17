import { request } from "../client";

interface PushRegisterResponse {
  ok: boolean;
  updated?: boolean;
}

interface RegisterPushPayload {
  token: string;
  platform: string;
  deviceId?: string;
}

export const registerPushDevice = (payload: RegisterPushPayload) =>
  request<PushRegisterResponse>({
    url: "/notifications/register",
    method: "POST",
    data: payload,
    // Render (free) puede tardar en despertar; si timeout es corto, el token no se registra.
    timeout: 70000,
  });

export const unregisterPushDevice = (token: string) =>
  request<{ ok: boolean }>({
    url: "/notifications/unregister",
    method: "POST",
    data: { token },
    skipUnauthorizedHandler: true,
  });
