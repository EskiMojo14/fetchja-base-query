import { configureStore } from "@reduxjs/toolkit";
import { createApi } from "@reduxjs/toolkit/query";
import { http, HttpResponse } from "msw";
import { assert, describe, expect, it } from "vite-plus/test";
import { fetchjaBaseQuery } from "./index.ts";
import { server } from "../tests/setup.ts";

const baseURL = "https://api.example.test";
const jsonApiHeaders = { "Content-Type": "application/vnd.api+json" };

interface Person {
  type: "people";
  id: string;
  name: string;
}

interface Article {
  type: "articles";
  id: string;
  title: string;
  author?: Person;
  links?: unknown;
}

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

function setupApi() {
  const baseQuery = fetchjaBaseQuery({ baseURL });
  const api = createApi({
    baseQuery,
    endpoints: (builder) => ({
      getArticle: builder.query<Article, string>({
        query: (id) => ({
          method: "GET",
          model: `articles/${id}`,
          params: { include: "author" },
        }),
        // `meta` carries the document's top-level `links`/`meta`/`jsonapi`, since `data` is just the resource.
        transformResponse: (response: Article, meta) => ({ ...response, links: meta?.links }),
      }),
      getArticles: builder.query<Article[], void>({
        query: () => "articles",
      }),
      getArticleWithRequest: builder.query<Article, string>({
        query: (id) => ({
          kind: "request",
          url: `articles/${id}`,
          method: "GET",
          params: { include: "author" },
        }),
      }),
      listArticles: builder.infiniteQuery<ArticlePage, void, string | undefined>({
        infiniteQueryOptions: {
          initialPageParam: undefined,
          getNextPageParam: (lastPage) => lastPage.next,
        },
        query: ({ pageParam }) =>
          pageParam
            ? { kind: "request", url: pageParam, method: "GET" }
            : { method: "GET", model: "articles", params: { page: { size: 2 } } },
        transformResponse: (data, meta): ArticlePage => ({
          items: data as Article[],
          next: getLinkUrl(meta?.links?.next),
        }),
      }),
      updateArticle: builder.mutation<Article, { id: string; title: string; authorId: string }>({
        query: ({ id, title, authorId }) => ({
          method: "PATCH",
          model: "article",
          body: { id, title, author: { type: "people", id: authorId } },
        }),
      }),
    }),
  });

  const store = configureStore({
    reducer: { [api.reducerPath]: api.reducer },
    middleware: (getDefaultMiddleware) => getDefaultMiddleware().concat(api.middleware),
  });

  return { api, store };
}

describe("fetchjaBaseQuery", () => {
  it("returns data on a successful query", async () => {
    server.use(
      http.get(`${baseURL}/articles/1`, () =>
        HttpResponse.json(
          {
            data: {
              type: "articles",
              id: "1",
              attributes: { title: "JSON:API paints my bikeshed!" },
              relationships: { author: { data: { type: "people", id: "9" } } },
            },
            included: [{ type: "people", id: "9", attributes: { name: "Dan Gebhardt" } }],
            links: { self: `${baseURL}/articles/1` },
          },
          { headers: jsonApiHeaders },
        ),
      ),
    );

    const { api, store } = setupApi();
    const result = await store.dispatch(api.endpoints.getArticle.initiate("1"));

    expect(result.data).toEqual({
      type: "articles",
      id: "1",
      title: "JSON:API paints my bikeshed!",
      author: { type: "people", id: "9", name: "Dan Gebhardt" },
      links: { self: `${baseURL}/articles/1` },
    });
  });

  it("returns an error on a failed query", async () => {
    server.use(
      http.get(`${baseURL}/articles/404`, () =>
        HttpResponse.json(
          { errors: [{ status: "404", title: "Not Found", detail: "Article not found" }] },
          { status: 404, headers: jsonApiHeaders },
        ),
      ),
    );

    const { api, store } = setupApi();
    const result = await store.dispatch(api.endpoints.getArticle.initiate("404"));

    expect(result.error).toMatchObject({
      status: 404,
      errors: [{ status: "404", title: "Not Found", detail: "Article not found" }],
    });
  });

  it("supports strings as GET model shorthands", async () => {
    server.use(
      http.get(`${baseURL}/articles`, () =>
        HttpResponse.json(
          {
            data: [
              {
                type: "articles",
                id: "1",
                attributes: { title: "Shorthand" },
              },
            ],
          },
          { headers: jsonApiHeaders },
        ),
      ),
    );

    const { api, store } = setupApi();
    const result = await store.dispatch(api.endpoints.getArticles.initiate());

    expect(result.data).toEqual([
      {
        type: "articles",
        id: "1",
        title: "Shorthand",
      },
    ]);
  });

  it("supports the low-level request escape hatch", async () => {
    server.use(
      http.get(`${baseURL}/articles/raw`, () =>
        HttpResponse.json(
          {
            data: {
              type: "articles",
              id: "raw",
              attributes: { title: "Raw request" },
            },
          },
          { headers: jsonApiHeaders },
        ),
      ),
    );

    const { api, store } = setupApi();
    const result = await store.dispatch(api.endpoints.getArticleWithRequest.initiate("raw"));

    expect(result.data).toEqual({
      type: "articles",
      id: "raw",
      title: "Raw request",
    });
  });

  it("follows JSON:API next links for infinite-query pages", async () => {
    let initialRequestUrl: URL | undefined;

    server.use(
      http.get(`${baseURL}/articles`, ({ request }) => {
        const url = new URL(request.url);
        if (url.searchParams.has("cursor")) {
          return HttpResponse.json(
            {
              data: [{ type: "articles", id: "2", attributes: { title: "Second" } }],
              links: { next: null },
            },
            { headers: jsonApiHeaders },
          );
        }

        initialRequestUrl = url;

        return HttpResponse.json(
          {
            data: [{ type: "articles", id: "1", attributes: { title: "First" } }],
            links: { next: "/articles?cursor=next" },
          },
          { headers: jsonApiHeaders },
        );
      }),
    );

    const { api, store } = setupApi();
    const result = await store.dispatch(api.endpoints.listArticles.initiate(undefined));

    expect(initialRequestUrl).toHaveSearchParam("page[size]", "2");
    expect(result.data?.pages).toEqual([
      {
        items: [{ type: "articles", id: "1", title: "First" }],
        next: "/articles?cursor=next",
      },
    ]);

    const nextResult = await store.dispatch(
      api.endpoints.listArticles.initiate(undefined, { direction: "forward" }),
    );

    expect(nextResult.data?.pages).toEqual([
      {
        items: [{ type: "articles", id: "1", title: "First" }],
        next: "/articles?cursor=next",
      },
      { items: [{ type: "articles", id: "2", title: "Second" }] },
    ]);
  });

  it("passes extra top-level response properties through to meta", async () => {
    server.use(
      http.get(`${baseURL}/articles/100`, () =>
        HttpResponse.json(
          {
            data: { type: "articles", id: "100", attributes: { title: "Extra" } },
            meta: { total: 42 },
          },
          { headers: jsonApiHeaders },
        ),
      ),
    );

    const baseQuery = fetchjaBaseQuery({ baseURL });
    const result = await baseQuery({ method: "GET", model: "articles/100" });

    assert(!("error" in result), "Expected query to succeed");

    expect(result.data).toEqual({ type: "articles", id: "100", title: "Extra" });
    expect(result.meta).toMatchObject({
      status: 200,
      statusText: "OK",
      meta: { total: 42 },
    });
  });

  it("preserves extra top-level keys when raw option is enabled", async () => {
    server.use(
      http.get(`${baseURL}/articles/raw-extra`, () =>
        HttpResponse.json(
          {
            data: { type: "articles", id: "1", attributes: { title: "Raw" } },
            extraTopLevelKey: "extraValue",
          },
          { headers: jsonApiHeaders },
        ),
      ),
    );

    const baseQuery = fetchjaBaseQuery({ baseURL });
    const result = await baseQuery({
      kind: "request",
      url: "articles/raw-extra",
      method: "GET",
      raw: true,
    });

    assert(!("error" in result), "Expected query to succeed");

    expect(result.meta).toMatchObject({
      extraTopLevelKey: "extraValue",
    });
  });

  it("updates a resource via a mutation", async () => {
    let requestBody: unknown;

    server.use(
      http.patch(`${baseURL}/articles/1`, async ({ request }) => {
        requestBody = await request.json();

        return HttpResponse.json(
          {
            data: {
              type: "articles",
              id: "1",
              attributes: { title: "Updated!" },
              relationships: { author: { data: { type: "people", id: "9" } } },
            },
            included: [{ type: "people", id: "9", attributes: { name: "Dan Gebhardt" } }],
          },
          { headers: jsonApiHeaders },
        );
      }),
    );

    const { api, store } = setupApi();
    const result = await store.dispatch(
      api.endpoints.updateArticle.initiate({ id: "1", title: "Updated!", authorId: "9" }),
    );

    expect(requestBody).toEqual({
      data: {
        type: "articles",
        id: "1",
        attributes: { title: "Updated!" },
        relationships: { author: { data: { type: "people", id: "9" } } },
      },
    });
    expect(result.data).toEqual({
      type: "articles",
      id: "1",
      title: "Updated!",
      author: { type: "people", id: "9", name: "Dan Gebhardt" },
    });
  });
});
