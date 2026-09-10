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

export type KeyofUnion<T> = T extends T ? keyof T : never;
export type OneOf<T, K extends KeyofUnion<T> = KeyofUnion<T>> = T extends T
  ? T & Partial<Record<Exclude<K, keyof T>, never>>
  : never;

/** Options passed through to a Fetchja verb method. */
export type FetchjaBaseQueryOptions = Omit<RequestOptions, "url" | "method" | "body">;

/** The arguments accepted by a query created with {@link fetchjaBaseQuery}. */
export type FetchjaBaseQueryArgs = OneOf<
  | { method: "GET"; model: string; options?: FetchjaBaseQueryOptions }
  | {
      method: "POST" | "PATCH";
      model: string;
      body: Record<string, unknown>;
      options?: FetchjaBaseQueryOptions;
    }
  | { method: "DELETE"; model: string; id: string; options?: FetchjaBaseQueryOptions }
  | { kind: "request"; options: RequestOptions & { url: string } }
>;

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
  FetchjaBaseQueryArgs,
  unknown,
  FetchjaBaseQueryError,
  Record<string, unknown>,
  FetchjaBaseQueryMeta
> {
  const client = options instanceof Fetchja ? options : new Fetchja(options);

  return async (arg) => {
    try {
      let response: Promise<Record<string, unknown>>;
      if (arg.kind === "request") {
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
      const { status, statusText, headers, data, meta, links, jsonapi } = await response;
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
