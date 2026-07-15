// KasirGo WASM build
// Usage:
//   zig build                          # ReleaseFast (default)
//   zig build -Doptimize=ReleaseSafe  # safer
//   zig build -Doptimize=Debug        # debug build
// Output:
//   zig-out/bin/kasir.wasm            # default install location
//   ../frontend/public/kasir.wasm     # auto-copied (cross-platform)

const std = @import("std");

const wasm_exports = [_][]const u8{
    "init_memory",
    "get_memory_ptr",
    "get_input_ptr",
    "get_input_size",
    "get_memory_usage",
    "get_memory_size",
    "reset_memory",
    "catalog_clear",
    "catalog_get_count",
    "catalog_set_timestamp",
    "catalog_get_timestamp",
    "load_products",
    "get_product",
    "update_stock",
    "get_product_stock",
    "catalog_is_expired",
    "batch_check_low_stock",
    "cart_init",
    "cart_add_item",
    "cart_get_item_count",
    "cart_remove_item",
    "cart_update_qty",
    "cart_clear",
    "cart_get_items",
    "cart_get_totals",
    "get_cart_view",
    "get_last_error",
    "get_last_error_msg",
    "get_last_error_len",
    "clear_error",
    "apply_discounts",
    "calculate_tax",
    "calculate_loyalty_points",
    "batch_calculate",
    "calculate_total",
    "compute_benchmark",
    "benchmark_cart_operations",
    "benchmark_catalog_query",
    "calculate_change",
    "calculate_subtotal_array",
};

pub fn build(b: *std.Build) void {
    const target = b.resolveTargetQuery(.{
        .cpu_arch = .wasm32,
        .os_tag = .freestanding,
        .abi = .none,
        .cpu_features_add = std.Target.wasm.featureSet(&.{.simd128}),
    });

    const optimize = b.option(
        std.builtin.OptimizeMode,
        "optimize",
        "Optimization mode (Debug, ReleaseSafe, ReleaseFast, ReleaseSmall)",
    ) orelse .ReleaseFast;

    const module = b.createModule(.{
        .root_source_file = b.path("main.zig"),
        .target = target,
        .optimize = optimize,
        .single_threaded = true,
        .strip = true,
        .stack_protector = false,
        .code_model = .small,
    });
    module.export_symbol_names = &wasm_exports;

    const wasm = b.addExecutable(.{
        .name = "kasir",
        .root_module = module,
        .use_llvm = true,
        .use_lld = true,
    });

    wasm.entry = .disabled;

    b.installArtifact(wasm);

    const install_copy = b.addInstallFile(wasm.getEmittedBin(), "../frontend/public/kasir.wasm");
    b.getInstallStep().dependOn(&install_copy.step);
}