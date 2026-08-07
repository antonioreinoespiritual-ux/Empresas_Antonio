import { toNextJsHandler } from "better-auth/next-js";
import { userAuth } from "@repo/core/infrastructure";

export const { GET, POST } = toNextJsHandler(userAuth);
