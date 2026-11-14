// Errors returned by `supabase.functions.invoke` carry the underlying HTTP response in
// `context` when the Edge Function replied with a non-2xx status. The generated client
// types do not expose it on the shared error union, so it is declared here once.
export type FunctionInvokeError = Error & { context?: Response };
