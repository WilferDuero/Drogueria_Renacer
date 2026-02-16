import { request } from "../client";
import {
  UserCreatePayload,
  UserSummary,
  UserUpdatePayload,
} from "../../types/domain";

export const listUsers = () =>
  request<UserSummary[]>({
    url: "/users",
    method: "GET",
  });

export const createUser = (payload: UserCreatePayload) =>
  request<{ id: number; username: string; role: string }>({
    url: "/users",
    method: "POST",
    data: payload,
  });

export const updateUser = (id: number, payload: UserUpdatePayload) =>
  request<{ ok: true }>({
    url: `/users/${id}`,
    method: "PUT",
    data: payload,
  });

