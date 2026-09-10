import { configureStore } from "@reduxjs/toolkit";
import { createApi } from "@reduxjs/toolkit/query";
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vite-plus/test";
import { fetchjaBaseQuery } from "../src/index.ts";
import { server } from "./setup.ts";

const baseURL = "https://api.example.test";
const jsonApiHeaders = { "Content-Type": "application/vnd.api+json" };

interface Person {
  type: string;
  id: string;
  name: string;
}

interface Article {
  type: string;
  id: string;
  title: string;
  author?: Person;
  links?: unknown;
}

function setupApi() {
  const api = createApi({
    baseQuery: fetchjaBaseQuery({ baseURL }),
    endpoints: (builder) => ({
      getArticle: builder.query<Article, string>({
        query: (id) => ({ method: "GET", model: `articles/${id}` }),
        // `meta` carries the document's top-level `links`/`meta`/`jsonapi`, since `data` is just the resource.
        transformResponse: (response: Article, meta) => ({ ...response, links: meta?.links }),
      }),
      getArticleWithRequest: builder.query<Article, string>({
        query: (id) => ({
          kind: "request",
          options: { url: `articles/${id}`, method: "GET" },
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
