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
  });

export const unregisterPushDevice = (token: string) =>
  request<{ ok: boolean }>({
    url: "/notifications/unregister",
    method: "POST",
    data: { token },
    skipUnauthorizedHandler: true,
  });
