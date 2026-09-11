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
 * @returns An RTK Query base query function that returns resource data on
 * success and a {@link FetchjaBaseQueryError} on Fetchja request failures.
 */
export function fetchjaBaseQuery(options?: FetchjaOptions | Fetchja) {
  const client = options instanceof Fetchja ? options : new Fetchja(options);

  return (async (arg) => {
    try {
      let response: Promise<Record<string, unknown>>;
      if (typeof arg === "string") {
        response = client.get(arg);
      } else if (arg.kind === "request") {
        const { kind: _kind, ...options } = arg;
        response = client.request(options);
      } else if (arg.kind === "atomic") {
        const { kind: _kind, operations, ...options } = arg;
        if (typeof client.atomic !== "function") {
          throw new Error(
            "Fetchja Atomic Operations is not configured. Add AtomicOperations from 'fetchja/atomic' to the client's extensions.",
          );
        }

        const { results, document, ...meta } = await client.atomic(operations, options);
        return {
          data: results,
          meta: {
            ...document,
            ...meta,
          } satisfies FetchjaBaseQueryMeta,
        };
      } else {
        switch (arg.method) {
          case "GET": {
            const { model, ...options } = arg;
            response = client.get(model, options);
            break;
          }
          case "POST": {
            const { model, body, ...options } = arg;
            response = client.post(model, body, options);
            break;
          }
          case "PATCH": {
            const { model, body, ...options } = arg;
            response = client.patch(model, body, options);
            break;
          }
          case "DELETE": {
            const { model, id, ...options } = arg;
            response = client.delete(model, id, options);
            break;
          }
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
    {},
    FetchjaBaseQueryMeta
  >;
}
