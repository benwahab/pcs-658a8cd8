// Faux client Supabase pour tester les Edge Functions sans réseau ni déploiement.
type Result = { data?: unknown; error?: { message: string } | null };
type Call = { table: string; ops: { op: string; args: unknown[] }[] };

export const state: {
  getUser: (token?: string) => Result;
  createUser: (attrs: unknown) => Result;
  updateUserById: () => Result;
  signInWithPassword: (creds: { email: string; password: string }) => Result;
  rpc: (name: string, args: unknown) => Result;
  table: (call: Call) => Result;
  deletedUsers: string[];
  calls: Call[];
} = {} as never;

export function reset() {
  state.getUser = () => ({ data: { user: null }, error: { message: "no" } });
  state.createUser = () => ({ data: { user: { id: "11111111-2222-3333-4444-555555555555" } }, error: null });
  state.updateUserById = () => ({ data: {}, error: null });
  state.signInWithPassword = () => ({ data: { session: null, user: null }, error: { message: "bad" } });
  state.rpc = () => ({ data: true, error: null });
  state.table = () => ({ data: null, error: null });
  state.deletedUsers = [];
  state.calls = [];
}
reset();

function builder(table: string) {
  const call: Call = { table, ops: [] };
  state.calls.push(call);
  const run = () => Promise.resolve({ data: null, error: null, ...state.table(call) });
  const b: Record<string, unknown> = {};
  for (const op of ["select", "eq", "ilike", "is", "in", "order", "limit", "insert", "update", "upsert", "delete"]) {
    b[op] = (...args: unknown[]) => { call.ops.push({ op, args }); return b; };
  }
  b.maybeSingle = run;
  b.single = run;
  b.then = (res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) => run().then(res, rej);
  return b;
}

export function createClient() {
  return {
    from: (t: string) => builder(t),
    rpc: async (name: string, args: unknown) => ({ data: null, error: null, ...state.rpc(name, args) }),
    auth: {
      getUser: async (token?: string) => state.getUser(token),
      signInWithPassword: async (c: { email: string; password: string }) => state.signInWithPassword(c),
      admin: {
        createUser: async (a: unknown) => state.createUser(a),
        updateUserById: async () => state.updateUserById(),
        deleteUser: async (id: string) => { state.deletedUsers.push(id); return { error: null }; },
      },
    },
  };
}
