import { request } from "../client";
import { HealthResponse } from "../../types/domain";

export const checkHealth = () =>
  request<HealthResponse>({
    url: "/health",
    method: "GET",
  });

