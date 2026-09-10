import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll } from "vite-plus/test";

export const server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
