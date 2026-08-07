import { toNextJsHandler } from "better-auth/next-js";
import { adminAuth } from "@repo/core/infrastructure";

export const { GET, POST } = toNextJsHandler(adminAuth);
