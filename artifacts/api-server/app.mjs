// Vercel detects Express from this entrypoint. Mount the bundled application
// produced by the build instead of loading unbundled TypeScript modules.
import express from "express";
import renovaApp from "./dist/app.mjs";

const app = express();
app.use(renovaApp);

export default app;
