# fetchja-base-query

An RTK Query `baseQuery` backed by the [fetchja](https://fetchja.dev/) JSON:API client.

## Install

```bash
pnpm add fetchja @reduxjs/toolkit fetchja-base-query
```

## Usage

Create the base query with the Fetchja client options, then return a typed
request descriptor from each endpoint's `query` function:

```ts
import { createApi } from "@reduxjs/toolkit/query/react";
import { fetchjaBaseQuery } from "fetchja-base-query";
import { Article, Person, Comment } from "./models";

const api = createApi({
  baseQuery: fetchjaBaseQuery({
    baseURL: "https://api.example.com",
  }),
  endpoints: (builder) => ({
    getArticle: builder.query<
      Article & {
        author: Person;
        comments: Comment[];
      },
      string
    >({
      query: (id) => ({
        method: "GET",
        model: `articles/${id}`,
        params: { include: "author,comments" },
      }),
    }),
  }),
});
```

The base query uses Fetchja's verb methods, so resource paths are handled with
Fetchja's casing and pluralization rules. The response's resource data is
returned as RTK Query `data`.

## API

### `fetchjaBaseQuery(options?)`

Creates an RTK Query `baseQuery` backed by Fetchja. Pass either Fetchja options
or an existing `Fetchja` instance.

```ts
fetchjaBaseQuery({
  baseURL: "https://api.example.com",
  headers: { Authorization: "Bearer token" },
});
```

### Query descriptors

The normal descriptor forms are:

```ts
// Read shorthand
"articles/1"

// Read
{ method: "GET", model: "articles/1", params?: ..., headers?: ... }

// Create
{ method: "POST", model: "articles", body: { title: "Hello" }, params?: ... }

// Update. Fetchja appends `body.id` to the model path.
{ method: "PATCH", model: "article", body: { id: "1", title: "Updated" } }

// Delete
{ method: "DELETE", model: "article", id: "1" }
```

Extra options (such as query `params`, `headers`, a resource `type`, a JSON:API
`document`, or `raw`) can be included directly on the descriptor object alongside
`method`, `model`, `body`, and `id`.

### Request escape hatch

For methods or payloads not covered by the built-in verbs, use the low-level
request descriptor. It passes options directly to Fetchja's `request`:

```ts
query: () => ({
  kind: "request",
  url: "bulk",
  method: "POST",
  body: "...",
  raw: true,
});
```

This is useful for custom HTTP methods, raw JSON:API documents, extension
requests, and endpoints that do not follow resource CRUD conventions.

### Response metadata

Resource data is returned as `data`. HTTP and top-level JSON:API metadata is
returned as the base query metadata and is available to `transformResponse`:

```ts
transformResponse: (data, meta) => ({
  resource: data,
  links: meta?.links,
  status: meta?.status,
});
```

The metadata includes `status`, `statusText`, `headers`, and the document-level
`meta`, `links`, and `jsonapi` members, as well as any extra top-level properties
present on the response (such as when using `raw: true` or custom Fetchja extensions).
Resource-level Fetchja metadata remains on the resource's `$` field.

### Infinite queries with pagination links

<details>
<summary>
 Expand for details
</summary>

RTK Query's infinite queries can use Fetchja's document-level `links.next` as
the next page parameter:

```ts
interface ArticlePage {
  items: Article[];
  next?: string;
}

const getLinkUrl = (link: unknown) =>
  typeof link === "string"
    ? link
    : link && typeof link === "object" && "href" in link && typeof link.href === "string"
      ? link.href
      : undefined;

const api = createApi({
  baseQuery: fetchjaBaseQuery({
    baseURL: "https://api.example.com",
  }),
  endpoints: (builder) => ({
    listArticles: builder.infiniteQuery<ArticlePage, void, string | undefined>({
      infiniteQueryOptions: {
        initialPageParam: undefined,
        getNextPageParam: (lastPage) => lastPage.next,
      },
      query: ({ pageParam }) =>
        pageParam
          ? {
              kind: "request",
              url: pageParam,
              method: "GET",
            }
          : {
              method: "GET",
              model: "articles",
              params: { page: { size: 20 } },
            },
      transformResponse: (data, meta): ArticlePage => ({
        items: data as Article[],
        next: getLinkUrl(meta?.links?.next),
      }),
    }),
  }),
});
```

The first request uses the normal `GET` descriptor. Later requests use the
server-provided `links.next` URL through the request escape hatch, preserving
the server's cursor and query parameters.

</details>

### Typing Fetchja's transformed data

OpenAPI-generated JSON:API models usually describe the wire format, where
attributes are nested and relationships contain resource identifiers. Use
`FetchjaResource` to derive the flattened shape returned by Fetchja:

```ts
import type { FetchjaResource } from "fetchja-base-query";

interface RawArticle {
  type: "articles";
  id: string;
  attributes: { title: string };
  relationships: {
    author: { data: { type: "people"; id: string } };
    comments: { data: { type: "comments"; id: string }[] };
  };
}

interface RawPerson {
  type: "people";
  id: string;
  attributes: { name: string };
}

interface RawComment {
  type: "comments";
  id: string;
  attributes: { body: string };
}

type Article = FetchjaResource<RawArticle, RawPerson | RawComment>;
```

`Article` has `type`, `id`, and `title` at the top level, with `author` as a
`RawPerson`-derived object and `comments` as an array of `RawComment`-derived
objects. Resource-level JSON:API metadata is represented by `$`, matching
Fetchja's runtime output. If a relationship's resource type is not present in
the `included` union, the relationship remains its raw identifier shape.

## Development

- Install dependencies:

```bash
vp install
```

- Run the unit tests:

```bash
vp test
```

- Build the library:

```bash
vp pack
```
