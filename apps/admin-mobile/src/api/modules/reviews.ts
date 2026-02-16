import { request } from "../client";
import { Review } from "../../types/domain";

export const listReviews = () =>
  request<Review[]>({
    url: "/reviews",
    method: "GET",
  });

export const clearReviews = () =>
  request<{ ok: true }>({
    url: "/reviews",
    method: "DELETE",
  });

