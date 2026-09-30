// Vercel's Express preset picks this root entrypoint. The build creates the
// bundled application, so the function does not load unbundled TypeScript
// modules with directory imports under Node's ESM resolver.
export { default } from "./dist/app.mjs";
