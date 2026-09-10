import {
  Fetchja,
  FetchjaError,
  type FetchjaOptions,
  type RequestOptions,
  type JsonApiError,
  type JsonApiMeta,
  type JsonApiLinks,
  type JsonApiObject,
} from "fetchja";
import type { BaseQueryFn } from "@reduxjs/toolkit/query";

/** The arguments accepted by a query created with {@link fetchjaBaseQuery}. */
export type FetchjaBaseQueryArgs = RequestOptions & { url: string };

/** The shape of the error surfaced to RTK Query when a request fails. */
export interface FetchjaBaseQueryError {
  status?: number;
  statusText?: string;
  errors?: JsonApiError[];
  data?: Record<string, unknown>;
}

/** The response metadata surfaced to RTK Query alongside a successful result. */
export interface FetchjaBaseQueryMeta {
  status: number;
  statusText: string;
  headers: Record<string, string>;
  /** The document's top-level `meta`, `links`, and `jsonapi` members, if present. */
  meta?: JsonApiMeta;
  links?: JsonApiLinks;
  jsonapi?: JsonApiObject;
}

/**
 * Creates an RTK Query `baseQuery` backed by a {@link Fetchja} client.
 *
 * @param options - {@link FetchjaOptions} to build a client with, or an
 * existing {@link Fetchja} instance to reuse.
 */
export function fetchjaBaseQuery(
  options?: FetchjaOptions | Fetchja,
): BaseQueryFn<
  string | FetchjaBaseQueryArgs,
  unknown,
  FetchjaBaseQueryError,
  Record<string, unknown>,
  FetchjaBaseQueryMeta
> {
  const client = options instanceof Fetchja ? options : new Fetchja(options);

  return async (arg) => {
    const requestOptions: RequestOptions = typeof arg === "string" ? { url: arg } : arg;

    try {
      // `request` merges HTTP metadata and the document's own `meta`/`links`/`jsonapi`
      // in with `data`, so pull them apart and leave `data` as just the resource(s).
      const { status, statusText, headers, data, meta, links, jsonapi } = await client.request({
        method: "GET",
        ...requestOptions,
      });
      return {
        data,
        meta: { status, statusText, headers, meta, links, jsonapi } as FetchjaBaseQueryMeta,
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
  };
}
