export function handleCronError(err: unknown, context = "Unknown") {
    const timestamp = new Date().toISOString();
    const error = err instanceof Error ? err : new Error(JSON.stringify(err));
    console.error(
        `\n❌ [${timestamp}] CRON ERROR in ${context}:\n${error.message}\n${error.stack}\n`
    );
}
