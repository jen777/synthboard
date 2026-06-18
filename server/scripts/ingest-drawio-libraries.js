#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";

function argValue(args, name) {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : null;
}

function hasArg(args, name) {
  return args.includes(name);
}

function usage() {
  console.log(`Usage:
  npm run ingest:drawio-libraries -- --manifest ./drawio-libraries/sources.json
  npm run ingest:drawio-libraries -- --file ./Azure-General.xml --id azure-general --name "Azure General" --provider Azure --style-family azure-flat
  npm run ingest:drawio-libraries -- --url https://example.com/icons.xml --id vendor-icons --name "Vendor Icons"

Environment must include the same DATABASE_URL and SESSION_SECRET required by the server.`);
}

async function readSource(source) {
  if (source.file) {
    return {
      content: await fs.readFile(path.resolve(source.file), "utf8"),
      sourceType: "file",
      sourceUrl: source.file,
    };
  }
  if (source.url) {
    const res = await fetch(source.url);
    if (!res.ok) {
      throw new Error(`Could not fetch ${source.url}: ${res.status} ${res.statusText}`);
    }
    return {
      content: await res.text(),
      sourceType: "url",
      sourceUrl: source.url,
    };
  }
  throw new Error("Each source needs either file or url.");
}

async function loadManifest(file) {
  const manifestPath = path.resolve(file);
  const data = JSON.parse(await fs.readFile(manifestPath, "utf8"));
  if (!Array.isArray(data.libraries)) {
    throw new Error("Manifest must contain a libraries array.");
  }
  return data.libraries.map((source) => ({
    ...source,
    file: source.file ? path.resolve(path.dirname(manifestPath), source.file) : null,
  }));
}

async function main() {
  const args = process.argv.slice(2);
  if (hasArg(args, "--help") || args.length === 0) {
    usage();
    return;
  }

  const manifest = argValue(args, "--manifest");
  const sources = manifest
    ? await loadManifest(manifest)
    : [
        {
          file: argValue(args, "--file"),
          url: argValue(args, "--url"),
          id: argValue(args, "--id"),
          name: argValue(args, "--name"),
          provider: argValue(args, "--provider"),
          styleFamily: argValue(args, "--style-family"),
          version: argValue(args, "--version"),
        },
      ];

  let pool;
  try {
    const [db, libraries] = await Promise.all([
      import("../src/db.js"),
      import("../src/services/drawioLibraries.js"),
    ]);
    pool = db.pool;

    await db.initSchema();

    for (const source of sources) {
      const { content, sourceType, sourceUrl } = await readSource(source);
      const result = await libraries.ingestDrawioLibrary({
        id: source.id,
        name: source.name,
        provider: source.provider,
        styleFamily: source.styleFamily,
        version: source.version,
        sourceUrl,
        sourceType,
        content,
        metadata: source.metadata,
      });
      console.log(
        `Ingested ${result.objects} objects into ${result.libraryId} (${source.name || source.id}).`,
      );
    }
  } finally {
    await pool?.end().catch(() => {});
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
