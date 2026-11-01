import { readdir, readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { build } from "esbuild";
const files = (await readdir("out", { recursive: true })).filter(
  (file) =>
    /\.(html|js|css|png|svg|webmanifest|woff2)$/.test(file) &&
    file !== "sw.js" &&
    !file.startsWith("workbox-"),
);
const manifest = await Promise.all(
  files.map(async (file) => ({
    url: "/" + file.replaceAll("\\", "/"),
    revision: createHash("sha256")
      .update(await readFile("out/" + file))
      .digest("hex"),
  })),
);
await build({
  stdin: {
    contents: `
import {precacheAndRoute, cleanupOutdatedCaches, createHandlerBoundToURL} from 'workbox-precaching';
import {registerRoute, NavigationRoute} from 'workbox-routing';
import {clientsClaim} from 'workbox-core';
precacheAndRoute(${JSON.stringify(manifest)});
cleanupOutdatedCaches();
registerRoute(new NavigationRoute(createHandlerBoundToURL('/index.html')));
clientsClaim();
self.addEventListener('message', event => { if(event.data?.type === 'SKIP_WAITING') self.skipWaiting(); });
`,
    resolveDir: process.cwd(),
  },
  bundle: true,
  minify: true,
  outfile: "out/sw.js",
  define: { "process.env.NODE_ENV": '"production"' },
  target: "es2020",
});
console.log(`Precached ${manifest.length} assets with Workbox.`);
