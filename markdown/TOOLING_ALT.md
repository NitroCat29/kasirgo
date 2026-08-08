# TOOLING_ALT.md
> Sumber: AGENTS.md §8 (asli). BELUM final — jangan pakai tanpa konfirmasi El.
> Agent boleh SARANKAN dari sini, tidak boleh GANTI stack diam-diam.

```
- package_manager_alt : "pnpm" (symlink, hemat disk) | "vlt" (baru, eksperimental)
- runtime_alt          : "Deno" (TS native, permission sandbox --allow-net dst)
- test_runner_alt      : "bun test" (built-in, skip Jest/Vitest setup)
- lint_format_alt      : "Biome" (pengganti ESLint+Prettier, 1 binary Rust, cepat)
- db_lokal_alt         : "bun:sqlite" (built-in di Bun, untuk prototype/project kecil)
- monorepo_alt         : "Moon" (build system, caching agresif, config eksplisit)
```
