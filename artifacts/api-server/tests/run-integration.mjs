import { build } from "esbuild";
import { resolve } from "node:path";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { pathToFileURL } from "node:url";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const folder = await mkdtemp(resolve(tmpdir(), "renova-integration-"));
try {
  const outfile = resolve(folder, "test.mjs");
  await build({
    entryPoints: ["tests/security.integration.ts"],
    outfile,
    bundle: true,
    platform: "node",
    format: "esm",
    packages: "external",
    plugins: [
      {
        name: "isolated-postgres",
        setup(build) {
          build.onResolve({ filter: /^@workspace\/db$/ }, () => ({
            path: resolve("tests/database.ts"),
          }));
          build.onResolve({ filter: /^@workspace\/api-zod$/ }, () => ({
            path: resolve("../../lib/api-zod/src/index.ts"),
          }));
          build.onResolve({ filter: /^zod(\/.*)?$/ }, ({ path }) => ({
            path: require.resolve(path, {
              paths: [resolve("../../lib/api-zod")],
            }),
          }));
        },
      },
    ],
  });
  // External packages resolve relative to the test bundle's folder.
  const { symlink } = await import("node:fs/promises");
  await symlink(
    resolve("node_modules"),
    resolve(folder, "node_modules"),
    "dir",
  );
  await import(pathToFileURL(outfile).href);
} finally {
  await rm(folder, { recursive: true, force: true });
}
