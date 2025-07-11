import path from "node:path";
import {
  defineWorkersProject,
  readD1Migrations,
  WorkersProjectConfigExport,
} from "@cloudflare/vitest-pool-workers/config";
import wasm from "vite-plugin-wasm"



export default defineWorkersProject(async () => {
  // Read all migrations in the `migrations` directory
  const migrationsPath = path.join(__dirname, "migrations");
  const migrations = await readD1Migrations(migrationsPath);

  const options: WorkersProjectConfigExport = {
    plugins: [
      wasm()
    ],
    test: {
      setupFiles: ["./test/apply-migrations.ts"],
      poolOptions: {
        workers: {
          singleWorker: true,
          wrangler: {
            configPath: "./wrangler.toml",
          },
          miniflare: {
            bindings: {
              // Add a test-only binding for migrations, so we can apply them in a setup file
              TEST_MIGRATIONS: migrations,
              // test API key for authentication
              API_KEY: "test-api-key"
            },
            // kvNamespaces: ["TEST_NAMESPACE"],
          }
        },
      },
    },
  };

  return options;
});
