const projectId = process.env.PROJECT_ID as string;

// TODO:FIX - USE THE REFACTORED ENV CONFIG
if (!projectId) {
    throw new Error("NO PROJECT ID FOUND!");
}

const outputPath = "src/shared/types/supabase/db.ts";

const { stdout, stderr, success } = Bun.spawnSync(
    [
        "bunx",
        "supabase",
        "gen",
        "types",
        "typescript",
        "--project-id",
        projectId,
        "--schema",
        "public",
    ],
    {
        stdio: ["ignore", "pipe", "pipe"],
        env: {
            ...process.env,
            SUPABASE_ACCESS_TOKEN: process.env.SUPABASE_ACCESS_TOKEN,
        },
    }
);

if (!success) {
    console.error("❌ Failed to generate Supabase types:\n", stderr.toString());
    process.exit(1);
}

await Bun.write(outputPath, stdout);
console.log(`✅ Supabase types generated at: ${outputPath}`);

export {};
