import { request } from "../client";
import { AuthUser } from "../../types/domain";

interface LoginResponse {
  token: string;
  user: AuthUser;
}

export const loginAdmin = (username: string, password: string) =>
  request<LoginResponse>({
    url: "/auth/login",
    method: "POST",
    data: { username, password },
  });

export const fetchAuthMe = () =>
  request<AuthUser>({
    url: "/auth/me",
    method: "GET",
  });

