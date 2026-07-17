// Vitest runs in plain Node, not through Next's webpack resolution, so the
// real "server-only" package (which unconditionally throws, relying on
// Next's bundler to swap in a no-op for genuine server contexts) would break
// any test importing a module that has `import "server-only"` at the top.
// vitest.config.ts aliases "server-only" to this empty stub instead.
export {};
