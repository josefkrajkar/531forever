/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as ResendOTP from "../ResendOTP.js";
import type * as accessories from "../accessories.js";
import type * as auth from "../auth.js";
import type * as bodyweight from "../bodyweight.js";
import type * as exports from "../exports.js";
import type * as http from "../http.js";
import type * as programs from "../programs.js";
import type * as rateLimit from "../rateLimit.js";
import type * as readiness from "../readiness.js";
import type * as statistics from "../statistics.js";
import type * as users from "../users.js";
import type * as workouts from "../workouts.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  ResendOTP: typeof ResendOTP;
  accessories: typeof accessories;
  auth: typeof auth;
  bodyweight: typeof bodyweight;
  exports: typeof exports;
  http: typeof http;
  programs: typeof programs;
  rateLimit: typeof rateLimit;
  readiness: typeof readiness;
  statistics: typeof statistics;
  users: typeof users;
  workouts: typeof workouts;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
