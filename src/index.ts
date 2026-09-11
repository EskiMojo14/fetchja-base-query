import { Fetchja, FetchjaError, type FetchjaOptions } from "fetchja";
import type { BaseQueryFn } from "@reduxjs/toolkit/query";
import type { FetchjaBaseQueryArgs, FetchjaBaseQueryError, FetchjaBaseQueryMeta } from "./types.ts";

export type {
  FetchjaBaseQueryArgs,
  FetchjaBaseQueryError,
  FetchjaBaseQueryMeta,
  FetchjaBaseQueryOptions,
} from "./types.ts";
export type { FetchjaResource } from "./resource.ts";

/**
 * Creates an RTK Query `baseQuery` backed by a {@link Fetchja} client.
 *
 * @param options - {@link FetchjaOptions} to build a client with, or an
 * existing {@link Fetchja} instance to reuse.
 */
export function fetchjaBaseQuery(options?: FetchjaOptions | Fetchja) {
  const client = options instanceof Fetchja ? options : new Fetchja(options);

  return (async (arg) => {
    try {
      let response: Promise<Record<string, unknown>>;
      if (typeof arg === "string") {
        response = client.get(arg);
      } else if (arg.kind === "request") {
        response = client.request(arg.options);
      } else {
        switch (arg.method) {
          case "GET":
            response = client.get(arg.model, arg.options);
            break;
          case "POST":
            response = client.post(arg.model, arg.body, arg.options);
            break;
          case "PATCH":
            response = client.patch(arg.model, arg.body, arg.options);
            break;
          case "DELETE":
            response = client.delete(arg.model, arg.id, arg.options);
            break;
        }
      }

      // `request` merges HTTP metadata and the document's own `meta`/`links`/`jsonapi`
      // in with `data`, so pull them apart and leave `data` as just the resource(s).
      const { data, ...meta } = await response;
      return {
        data,
        meta: meta as unknown as FetchjaBaseQueryMeta,
      };
    } catch (error) {
      if (error instanceof FetchjaError) {
        return {
          error: {
            status: error.status,
            statusText: error.statusText,
            errors: error.errors,
            data: error.document,
          },
        };
      }

      throw error;
    }
  }) satisfies BaseQueryFn<
    FetchjaBaseQueryArgs,
    unknown,
    FetchjaBaseQueryError,
    Record<string, unknown>,
    FetchjaBaseQueryMeta
  >;
}
