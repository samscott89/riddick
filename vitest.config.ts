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
            // api-worker is the primary worker for handling API requests
            configPath: "./api-worker/wrangler.toml",
          },
          miniflare: {
            bindings: {
              // Add a test-only binding for migrations, so we can apply them in a setup file
              TEST_MIGRATIONS: migrations,
              // test API key for authentication
              API_KEY: "test-api-key"
            },
            compatibilityFlags: ["service_binding_extra_handlers"],
            r2Buckets: ["test-bucket"],
            workers: [
						// Configuration for "auxiliary" Worker dependencies.
						// Unfortunately, auxiliary Workers cannot load their configuration
						// from `wrangler.toml` files, and must be configured with Miniflare
						// `WorkerOptions`.
						{
							name: "crate-processor",
              modules: true,
							scriptPath: "./crate-processor/dist/index.js", // Built by `global-setup.ts`
							compatibilityDate: "2024-01-01",
							compatibilityFlags: ["nodejs_compat"],
              
							// bindings: { AUTH_PUBLIC_KEY: authKeypair.publicKey },
							// // Mock outbound `fetch()`es from the `auth-service`
							// outboundService: handleAuthServiceOutbound,
						},
					],
          }
        },
      },
    },
  };

  return options;
});
