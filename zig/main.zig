// kasir.zig
// Cara kompile:
// Compile command (Zig 0.14+):
// cd zig && zig build-exe main.zig -target wasm32-freestanding -O ReleaseFast -fno-entry \
//   --export=init_memory --export=get_memory_ptr --export=get_memory_usage --export=get_memory_size \
//   --export=reset_memory --export=catalog_clear --export=catalog_get_count \
//   --export=catalog_set_timestamp --export=catalog_get_timestamp --export=load_products \
//   --export=get_product --export=update_stock --export=get_product_stock --export=catalog_is_expired \
//   --export=batch_check_low_stock \
//   --export=cart_init --export=cart_add_item --export=cart_get_item_count --export=cart_remove_item \
//   --export=cart_update_qty --export=cart_clear --export=cart_get_items --export=cart_get_totals \
//   --export=get_cart_view --export=get_last_error --export=get_last_error_msg --export=get_last_error_len \
//   --export=clear_error --export=apply_discounts --export=calculate_tax --export=calculate_loyalty_points \
//   --export=batch_calculate --export=calculate_total --export=compute_benchmark \
//   --export=benchmark_cart_operations --export=benchmark_catalog_query \
//   --export=calculate_change --export=calculate_subtotal_array \
//   -femit-bin=../kasir.wasm
// Output akan menghasilkan file: kasir.wasm

const std = @import("std");

// ============================================================================
// STRUCTS — State Management
// ============================================================================

/// Product in catalog
pub const Product = struct {
    id: u32,
    price: f64,
    stock: u32,
    category: u8, // 0=food, 1=drink, 2=other
    name_ptr: u32, // pointer to name string in linear memory
    name_len: u32,
};

/// Item in shopping cart
pub const CartItem = struct {
    product_id: u32,
    quantity: u32,
    price_snapshot: f64, // price at time of add
};

/// Shopping cart
pub const Cart = struct {
    items: [64]CartItem, // max 64 items per cart
    item_count: u32,
    subtotal: f64,
    discount_amount: f64,
    tax_amount: f64,
    total: f64,
};

/// Discount rule types
pub const DiscountType = enum(u8) {
    percentage = 0,
    fixed_amount = 1,
    buy_x_get_y = 2,
    tiered = 3, // spend threshold → discount %
};

/// Discount rule
pub const DiscountRule = struct {
    rule_type: DiscountType,
    value1: f64, // percentage/amount/buy_qty/threshold
    value2: f64, // get_qty/discount% for tiered
    min_items: u32,
    product_category: u8, // 255 = all categories
};

// ============================================================================
// MEMORY ALLOCATOR — Fixed Buffer Arena (2MB reserved)
// ============================================================================

const MEMORY_SIZE = 2 * 1024 * 1024; // 2MB
var memory_buffer: [MEMORY_SIZE]u8 align(8) = undefined;
var memory_offset: usize = 0;

/// Initialize memory buffer — call once from JS
export fn init_memory() void {
    memory_offset = 0;
    // Zero out buffer
    @memset(&memory_buffer, 0);
}

/// Get pointer to memory buffer for JS access
export fn get_memory_ptr() [*]u8 {
    return &memory_buffer;
}

/// Get current memory usage
export fn get_memory_usage() usize {
    return memory_offset;
}

/// Get total memory buffer size
export fn get_memory_size() usize {
    return MEMORY_SIZE;
}

/// Simple bump allocator — allocate n bytes, return offset
/// Returns 0 if OOM
fn alloc_bytes(n: usize) usize {
    // Align to 8 bytes
    const aligned_n = (n + 7) & ~@as(usize, 7);

    if (memory_offset + aligned_n > MEMORY_SIZE) {
        return 0; // OOM
    }

    const offset = memory_offset;
    memory_offset += aligned_n;
    return offset;
}

/// Reset allocator (clear all allocations)
export fn reset_memory() void {
    memory_offset = 0;
}

// ============================================================================
// SERIALIZATION HELPERS — struct ↔ byte array
// ============================================================================

/// Write f64 to buffer at offset (little-endian)
fn write_f64(buf: []u8, offset: usize, value: f64) void {
    const bytes = @as([8]u8, @bitCast(value));
    @memcpy(buf[offset..][0..8], &bytes);
}

/// Read f64 from buffer at offset (little-endian)
fn read_f64(buf: []const u8, offset: usize) f64 {
    var bytes: [8]u8 = undefined;
    @memcpy(&bytes, buf[offset..][0..8]);
    return @bitCast(bytes);
}

/// Write u32 to buffer at offset (little-endian)
fn write_u32(buf: []u8, offset: usize, value: u32) void {
    const bytes = @as([4]u8, @bitCast(value));
    @memcpy(buf[offset..][0..4], &bytes);
}

/// Read u32 from buffer at offset (little-endian)
fn read_u32(buf: []const u8, offset: usize) u32 {
    var bytes: [4]u8 = undefined;
    @memcpy(&bytes, buf[offset..][0..4]);
    return @bitCast(bytes);
}

/// Write u8 to buffer
fn write_u8(buf: []u8, offset: usize, value: u8) void {
    buf[offset] = value;
}

/// Read u8 from buffer
fn read_u8(buf: []const u8, offset: usize) u8 {
    return buf[offset];
}

/// Serialize Product to bytes (fixed 32 bytes)
/// Layout: id(4) + price(8) + stock(4) + category(1) + name_ptr(4) + name_len(4) + padding(7)
fn serialize_product(product: *const Product, buf: []u8) void {
    write_u32(buf, 0, product.id);
    write_f64(buf, 4, product.price);
    write_u32(buf, 12, product.stock);
    write_u8(buf, 16, product.category);
    write_u32(buf, 17, product.name_ptr);
    write_u32(buf, 21, product.name_len);
}

/// Deserialize Product from bytes
fn deserialize_product(buf: []const u8) Product {
    return Product{
        .id = read_u32(buf, 0),
        .price = read_f64(buf, 4),
        .stock = read_u32(buf, 12),
        .category = read_u8(buf, 16),
        .name_ptr = read_u32(buf, 17),
        .name_len = read_u32(buf, 21),
    };
}

/// Serialize CartItem to bytes (fixed 16 bytes)
/// Layout: product_id(4) + quantity(4) + price_snapshot(8)
fn serialize_cart_item(item: *const CartItem, buf: []u8) void {
    write_u32(buf, 0, item.product_id);
    write_u32(buf, 4, item.quantity);
    write_f64(buf, 8, item.price_snapshot);
}

/// Deserialize CartItem from bytes
fn deserialize_cart_item(buf: []const u8) CartItem {
    return CartItem{
        .product_id = read_u32(buf, 0),
        .quantity = read_u32(buf, 4),
        .price_snapshot = read_f64(buf, 8),
    };
}

// ============================================================================
// PRODUCT CATALOG — Hash Map (product_id → Product)
// ============================================================================

const CATALOG_SIZE = 512; // max 512 products
var catalog: [CATALOG_SIZE]Product = undefined;
var catalog_occupied: [CATALOG_SIZE]bool = [_]bool{false} ** CATALOG_SIZE;
var catalog_count: u32 = 0;
var catalog_timestamp: u64 = 0; // for TTL (milliseconds since epoch)

/// Hash function for product_id
fn hash_product_id(id: u32) usize {
    return @as(usize, id) % CATALOG_SIZE;
}

/// Insert product into catalog (or update if exists)
/// Returns true if success, false if catalog full
fn catalog_insert(product: Product) bool {
    var index = hash_product_id(product.id);
    var probe_count: usize = 0;

    // Linear probing
    while (probe_count < CATALOG_SIZE) : (probe_count += 1) {
        if (!catalog_occupied[index]) {
            // Empty slot, insert here
            catalog[index] = product;
            catalog_occupied[index] = true;
            catalog_count += 1;
            return true;
        }

        if (catalog[index].id == product.id) {
            // Update existing
            catalog[index] = product;
            return true;
        }

        // Collision, try next slot
        index = (index + 1) % CATALOG_SIZE;
    }

    return false; // Catalog full
}

/// Find product by id
/// Returns pointer to product if found, null otherwise
fn catalog_find(id: u32) ?*Product {
    var index = hash_product_id(id);
    var probe_count: usize = 0;

    while (probe_count < CATALOG_SIZE) : (probe_count += 1) {
        if (!catalog_occupied[index]) {
            return null; // Not found
        }

        if (catalog[index].id == id) {
            return &catalog[index];
        }

        index = (index + 1) % CATALOG_SIZE;
    }

    return null;
}

/// Clear catalog
export fn catalog_clear() void {
    catalog_occupied = [_]bool{false} ** CATALOG_SIZE;
    catalog_count = 0;
    catalog_timestamp = 0;
}

/// Get catalog count
export fn catalog_get_count() u32 {
    return catalog_count;
}

/// Set catalog timestamp (for TTL check)
export fn catalog_set_timestamp(timestamp: u64) void {
    catalog_timestamp = timestamp;
}

/// Get catalog timestamp
export fn catalog_get_timestamp() u64 {
    return catalog_timestamp;
}

/// Load products from JSON-like binary format
/// Format: count(u32) + [id(u32) price(f64) stock(u32) category(u8) name_len(u32) name_bytes...]*
/// JS will serialize to this format before calling
/// Returns number of products loaded, 0 on error
export fn load_products(data_ptr: [*]const u8, data_len: usize) u32 {
    if (data_len < 4) return 0;

    const count = read_u32(data_ptr[0..data_len], 0);
    var offset: usize = 4;
    var loaded: u32 = 0;

    var i: u32 = 0;
    while (i < count and offset < data_len) : (i += 1) {
        // Need at least: id(4) + price(8) + stock(4) + category(1) + name_len(4) = 21 bytes
        if (offset + 21 > data_len) break;

        const id = read_u32(data_ptr[0..data_len], offset);
        const price = read_f64(data_ptr[0..data_len], offset + 4);
        const stock = read_u32(data_ptr[0..data_len], offset + 12);
        const category = read_u8(data_ptr[0..data_len], offset + 16);
        const name_len = read_u32(data_ptr[0..data_len], offset + 17);

        offset += 21;

        // Validate name_len
        if (offset + name_len > data_len) break;

        // Allocate space for name in memory buffer
        const name_offset = alloc_bytes(name_len);
        if (name_offset == 0) break; // OOM

        // Copy name to memory buffer
        @memcpy(memory_buffer[name_offset..][0..name_len], data_ptr[offset..][0..name_len]);

        const product = Product{
            .id = id,
            .price = price,
            .stock = stock,
            .category = category,
            .name_ptr = @intCast(name_offset),
            .name_len = name_len,
        };

        if (!catalog_insert(product)) break; // Catalog full

        loaded += 1;
        offset += name_len;
    }

    return loaded;
}

/// Get product by id — returns offset in memory buffer where Product is serialized
/// Returns 0 if not found
/// JS reads 32 bytes from returned offset to deserialize Product
export fn get_product(id: u32) usize {
    const product = catalog_find(id) orelse return 0;

    // Allocate 32 bytes for serialized product
    const offset = alloc_bytes(32);
    if (offset == 0) return 0; // OOM

    serialize_product(product, memory_buffer[offset..][0..32]);
    return offset;
}

/// Update stock for product
/// Returns 1 if success, 0 if product not found or invalid delta
export fn update_stock(id: u32, delta: i32) u32 {
    const product = catalog_find(id) orelse return 0;

    // Check for underflow
    if (delta < 0) {
        const abs_delta = @abs(delta);
        if (product.stock < @as(u32, @intCast(abs_delta))) {
            return 0; // Not enough stock
        }
        product.stock -= @as(u32, @intCast(abs_delta));
    } else {
        product.stock += @as(u32, @intCast(delta));
    }

    return 1;
}

/// Get product stock (for quick check)
export fn get_product_stock(id: u32) u32 {
    const product = catalog_find(id) orelse return 0;
    return product.stock;
}

/// Check if catalog is expired (TTL: 5 minutes = 300,000 ms)
/// JS passes current timestamp in milliseconds
/// Returns 1 if expired, 0 if still valid
export fn catalog_is_expired(current_timestamp: u64) u32 {
    if (catalog_timestamp == 0) return 1; // Not initialized

    const TTL_MS: u64 = 5 * 60 * 1000; // 5 minutes
    if (current_timestamp > catalog_timestamp + TTL_MS) {
        return 1; // Expired
    }

    return 0; // Still valid
}

/// Batch check low stock products
/// Input: count(u32) + [product_id(u32) stock(u32) threshold(u32)]*
/// Output: count(u32) + [product_id(u32)]* written to memory buffer
/// Returns offset in memory buffer where result is written
export fn batch_check_low_stock(data_ptr: [*]const u8, data_len: usize) usize {
    if (data_len < 4) return 0;

    const count = read_u32(data_ptr[0..data_len], 0);
    var offset: usize = 4;

    // Allocate result buffer: 4 + (count * 4) bytes max
    const max_result_size = 4 + (count * 4);
    const result_offset = alloc_bytes(max_result_size);
    if (result_offset == 0) return 0; // OOM

    var low_count: u32 = 0;
    var i: u32 = 0;

    while (i < count and offset + 12 <= data_len) : (i += 1) {
        const product_id = read_u32(data_ptr[0..data_len], offset);
        const stock = read_u32(data_ptr[0..data_len], offset + 4);
        const threshold = read_u32(data_ptr[0..data_len], offset + 8);

        if (stock <= threshold) {
            // Write product_id to result
            write_u32(memory_buffer[result_offset..], 4 + (low_count * 4), product_id);
            low_count += 1;
        }

        offset += 12;
    }

    // Write count at beginning
    write_u32(memory_buffer[result_offset..], 0, low_count);
    return result_offset;
}

// ============================================================================
// SHOPPING CART STATE — CRUD Operations
// ============================================================================

var global_cart: Cart = undefined;
var cart_initialized: bool = false;

/// Initialize shopping cart
export fn cart_init() void {
    global_cart = Cart{
        .items = undefined,
        .item_count = 0,
        .subtotal = 0.0,
        .discount_amount = 0.0,
        .tax_amount = 0.0,
        .total = 0.0,
    };
    cart_initialized = true;
}

/// Add item to cart
/// Returns: 0=success, 1=cart full, 2=product not found, 3=insufficient stock, 4=cart not initialized, 5=qty exceeds limit
export fn cart_add_item(product_id: u32, quantity: u32) u32 {
    if (!cart_initialized) return 4;
    if (global_cart.item_count >= 64) return 1; // Cart full
    if (quantity > 100) return 5; // Max qty limit

    const product = catalog_find(product_id) orelse return 2; // Product not found

    // Check stock
    if (product.stock < quantity) return 3; // Insufficient stock

    // Check if product already in cart — update quantity instead
    var i: u32 = 0;
    while (i < global_cart.item_count) : (i += 1) {
        if (global_cart.items[i].product_id == product_id) {
            const new_qty = global_cart.items[i].quantity + quantity;
            if (new_qty > 100) return 5; // Would exceed limit
            if (product.stock < new_qty) return 3; // Would exceed stock
            global_cart.items[i].quantity = new_qty;
            return 0;
        }
    }

    // Add new item
    global_cart.items[global_cart.item_count] = CartItem{
        .product_id = product_id,
        .quantity = quantity,
        .price_snapshot = product.price,
    };
    global_cart.item_count += 1;

    return 0;
}

/// Get cart item count
export fn cart_get_item_count() u32 {
    if (!cart_initialized) return 0;
    return global_cart.item_count;
}

/// Remove item from cart by index
/// Returns: 0=success, 1=invalid index, 2=cart not initialized
export fn cart_remove_item(index: u32) u32 {
    if (!cart_initialized) return 2;
    if (index >= global_cart.item_count) return 1;

    // Shift items down
    var i: u32 = index;
    while (i < global_cart.item_count - 1) : (i += 1) {
        global_cart.items[i] = global_cart.items[i + 1];
    }

    global_cart.item_count -= 1;
    return 0;
}

/// Update item quantity by index
/// Returns: 0=success, 1=invalid index, 2=qty exceeds limit (100), 3=insufficient stock, 4=cart not initialized
export fn cart_update_qty(index: u32, new_qty: u32) u32 {
    if (!cart_initialized) return 4;
    if (index >= global_cart.item_count) return 1;
    if (new_qty > 100) return 2; // Max qty limit
    if (new_qty == 0) return cart_remove_item(index); // Remove if qty=0

    const item = &global_cart.items[index];
    const product = catalog_find(item.product_id) orelse return 3;

    // Check stock for new quantity
    if (product.stock < new_qty) return 3;

    item.quantity = new_qty;
    return 0;
}

/// Clear cart
export fn cart_clear() void {
    if (!cart_initialized) return;
    global_cart.item_count = 0;
    global_cart.subtotal = 0.0;
    global_cart.discount_amount = 0.0;
    global_cart.tax_amount = 0.0;
    global_cart.total = 0.0;
}

/// Get cart items — serialize to memory buffer
/// Returns offset to binary data: item_count(u32) + [product_id(u32) quantity(u32) price_snapshot(f64)]*
/// Returns 0 if cart not initialized
export fn cart_get_items() usize {
    if (!cart_initialized) return 0;

    // Calculate size: 4 bytes (count) + 16 bytes per item
    const size = 4 + (global_cart.item_count * 16);
    const offset = alloc_bytes(size);
    if (offset == 0) return 0; // OOM

    // Write item count
    write_u32(memory_buffer[offset..], 0, global_cart.item_count);

    // Write items
    var i: u32 = 0;
    while (i < global_cart.item_count) : (i += 1) {
        const item_offset = 4 + (i * 16);
        serialize_cart_item(&global_cart.items[i], memory_buffer[offset + item_offset ..][0..16]);
    }

    return offset;
}

/// Get cart totals — serialize to memory buffer
/// Returns offset to: subtotal(f64) discount(f64) tax(f64) total(f64) = 32 bytes
export fn cart_get_totals() usize {
    if (!cart_initialized) return 0;

    const offset = alloc_bytes(32);
    if (offset == 0) return 0;

    write_f64(memory_buffer[offset..], 0, global_cart.subtotal);
    write_f64(memory_buffer[offset..], 8, global_cart.discount_amount);
    write_f64(memory_buffer[offset..], 16, global_cart.tax_amount);
    write_f64(memory_buffer[offset..], 24, global_cart.total);

    return offset;
}

/// Get cart view as typed array offset — for zero-copy JS access
/// Returns offset to Float64Array-compatible layout: [subtotal, discount, tax, total, item_count_f64, ...items_flat]
/// Each item: [product_id_f64, quantity_f64, price_snapshot]
/// Total size: 5 + (item_count * 3) floats
export fn get_cart_view() usize {
    if (!cart_initialized) return 0;

    const float_count = 5 + (global_cart.item_count * 3);
    const size = float_count * 8; // 8 bytes per f64
    const offset = alloc_bytes(size);
    if (offset == 0) return 0;

    // Write header (5 floats)
    write_f64(memory_buffer[offset..], 0, global_cart.subtotal);
    write_f64(memory_buffer[offset..], 8, global_cart.discount_amount);
    write_f64(memory_buffer[offset..], 16, global_cart.tax_amount);
    write_f64(memory_buffer[offset..], 24, global_cart.total);
    write_f64(memory_buffer[offset..], 32, @as(f64, @floatFromInt(global_cart.item_count)));

    // Write items (3 floats each)
    var i: u32 = 0;
    while (i < global_cart.item_count) : (i += 1) {
        const item_offset = 40 + (i * 24); // 5*8 + i*3*8
        write_f64(memory_buffer[offset..], item_offset, @as(f64, @floatFromInt(global_cart.items[i].product_id)));
        write_f64(memory_buffer[offset..], item_offset + 8, @as(f64, @floatFromInt(global_cart.items[i].quantity)));
        write_f64(memory_buffer[offset..], item_offset + 16, global_cart.items[i].price_snapshot);
    }

    return offset;
}

// ============================================================================
// ERROR HANDLING
// ============================================================================

var last_error_code: u32 = 0;
var last_error_msg: [256]u8 = undefined;
var last_error_len: u32 = 0;

/// Set error (internal helper)
fn set_error(code: u32, msg: []const u8) void {
    last_error_code = code;
    last_error_len = @min(msg.len, 255);
    @memcpy(last_error_msg[0..last_error_len], msg[0..last_error_len]);
}

/// Get last error code
export fn get_last_error() u32 {
    return last_error_code;
}

/// Get last error message — returns offset to string in memory buffer
export fn get_last_error_msg() usize {
    if (last_error_len == 0) return 0;

    const offset = alloc_bytes(last_error_len);
    if (offset == 0) return 0;

    @memcpy(memory_buffer[offset..][0..last_error_len], last_error_msg[0..last_error_len]);
    return offset;
}

/// Get last error message length
export fn get_last_error_len() u32 {
    return last_error_len;
}

/// Clear error
export fn clear_error() void {
    last_error_code = 0;
    last_error_len = 0;
}

// ============================================================================
// DISCOUNT ENGINE — percentage, fixed, buy-X-get-Y, tiered
// ============================================================================

/// Calculate discount for cart based on single rule
/// Returns discount amount
fn apply_single_discount(cart: *Cart, rule: *const DiscountRule) f64 {
    // Calculate subtotal first
    var subtotal: f64 = 0.0;
    var i: u32 = 0;
    while (i < cart.item_count) : (i += 1) {
        const item = &cart.items[i];
        subtotal += item.price_snapshot * @as(f64, @floatFromInt(item.quantity));
    }

    var discount: f64 = 0.0;

    switch (rule.rule_type) {
        .percentage => {
            // Simple percentage discount
            if (cart.item_count >= rule.min_items) {
                discount = subtotal * (rule.value1 / 100.0);
            }
        },
        .fixed_amount => {
            // Fixed amount discount
            if (cart.item_count >= rule.min_items) {
                discount = rule.value1;
                if (discount > subtotal) discount = subtotal; // Cap at subtotal
            }
        },
        .buy_x_get_y => {
            // Buy X get Y free (category-specific or all)
            const buy_qty = @as(u32, @intFromFloat(rule.value1));
            const get_qty = @as(u32, @intFromFloat(rule.value2));

            var total_eligible: u32 = 0;
            i = 0;
            while (i < cart.item_count) : (i += 1) {
                const item = &cart.items[i];
                const product = catalog_find(item.product_id) orelse continue;

                // Check category filter (255 = all categories)
                if (rule.product_category != 255 and product.category != rule.product_category) continue;

                total_eligible += item.quantity;
            }

            // Calculate free items
            const sets = total_eligible / (buy_qty + get_qty);
            const free_items = sets * get_qty;

            // Find cheapest items to discount
            // Simple approach: average price * free_items
            if (total_eligible > 0 and free_items > 0) {
                const avg_price = subtotal / @as(f64, @floatFromInt(total_eligible));
                discount = avg_price * @as(f64, @floatFromInt(free_items));
            }
        },
        .tiered => {
            // Spend threshold → discount %
            if (subtotal >= rule.value1) {
                discount = subtotal * (rule.value2 / 100.0);
            }
        },
    }

    return discount;
}

/// Apply multiple discount rules to cart
/// Rules passed as binary: count(u32) + [type(u8) value1(f64) value2(f64) min_items(u32) category(u8)]*
/// Returns discount amount applied (takes best discount)
export fn apply_discounts(rules_ptr: [*]const u8, rules_len: usize) f64 {
    if (!cart_initialized) return 0.0;
    if (rules_len < 4) return 0.0;

    const rule_count = read_u32(rules_ptr[0..rules_len], 0);
    var best_discount: f64 = 0.0;
    var offset: usize = 4;

    // Each rule: type(u8) + value1(f64) + value2(f64) + min_items(u32) + category(u8) = 26 bytes
    const RULE_SIZE = 26;

    var i: u32 = 0;
    while (i < rule_count and offset + RULE_SIZE <= rules_len) : (i += 1) {
        const rule_type_val = read_u8(rules_ptr[0..rules_len], offset);
        const value1 = read_f64(rules_ptr[0..rules_len], offset + 1);
        const value2 = read_f64(rules_ptr[0..rules_len], offset + 9);
        const min_items = read_u32(rules_ptr[0..rules_len], offset + 17);
        const category = read_u8(rules_ptr[0..rules_len], offset + 21);

        const rule = DiscountRule{
            .rule_type = @enumFromInt(rule_type_val),
            .value1 = value1,
            .value2 = value2,
            .min_items = min_items,
            .product_category = category,
        };

        const discount = apply_single_discount(&global_cart, &rule);
        if (discount > best_discount) {
            best_discount = discount;
        }

        offset += RULE_SIZE;
    }

    global_cart.discount_amount = best_discount;
    return best_discount;
}

/// Calculate tax — region_code affects rate
/// region: 0=Jakarta (11%), 1=Jawa (10%), 2=Luar Jawa (5%), 255=custom rate
/// If region=255, uses tax_rate parameter
export fn calculate_tax(subtotal: f64, tax_rate: f64, region_code: u8) f64 {
    var rate: f64 = tax_rate;

    // Region-based rates
    switch (region_code) {
        0 => rate = 11.0, // Jakarta
        1 => rate = 10.0, // Jawa
        2 => rate = 5.0, // Luar Jawa
        255 => {}, // Use provided rate
        else => rate = 10.0, // Default
    }

    const tax = subtotal * (rate / 100.0);

    if (cart_initialized) {
        global_cart.tax_amount = tax;
    }

    return tax;
}

/// Calculate loyalty points based on tier
/// tier: 0=bronze (1x), 1=silver (1.5x), 2=gold (2x)
/// Base: 1 point per Rp 1000
export fn calculate_loyalty_points(total: f64, tier: u8) u32 {
    const base_points = @as(u32, @intFromFloat(total / 1000.0));

    var multiplier: f64 = 1.0;
    switch (tier) {
        0 => multiplier = 1.0, // Bronze
        1 => multiplier = 1.5, // Silver
        2 => multiplier = 2.0, // Gold
        else => multiplier = 1.0,
    }

    return @intFromFloat(@as(f64, @floatFromInt(base_points)) * multiplier);
}

/// Batch calculate — process multiple carts
/// Input: carts_ptr points to binary: cart_count(u32) + [cart_data]*
/// Each cart_data: item_count(u32) + [product_id(u32) qty(u32)]* + tax_region(u8)
/// Output: results written to memory buffer, returns offset
/// Result format: count(u32) + [subtotal(f64) discount(f64) tax(f64) total(f64)]*
export fn batch_calculate(carts_ptr: [*]const u8, carts_len: usize, rules_ptr: [*]const u8, rules_len: usize) usize {
    if (carts_len < 4) return 0;

    const cart_count = read_u32(carts_ptr[0..carts_len], 0);

    // Allocate result buffer: 4 + (cart_count * 32) bytes
    const result_size = 4 + (cart_count * 32);
    const result_offset = alloc_bytes(result_size);
    if (result_offset == 0) return 0; // OOM

    write_u32(memory_buffer[result_offset..], 0, cart_count);

    var offset: usize = 4;
    var result_idx: u32 = 0;

    while (result_idx < cart_count and offset < carts_len) : (result_idx += 1) {
        // Parse cart
        if (offset + 4 > carts_len) break;

        const item_count = read_u32(carts_ptr[0..carts_len], offset);
        offset += 4;

        // Create temporary cart
        var temp_cart = Cart{
            .items = undefined,
            .item_count = 0,
            .subtotal = 0.0,
            .discount_amount = 0.0,
            .tax_amount = 0.0,
            .total = 0.0,
        };

        // Read items
        var i: u32 = 0;
        while (i < item_count and i < 64 and offset + 8 <= carts_len) : (i += 1) {
            const product_id = read_u32(carts_ptr[0..carts_len], offset);
            const qty = read_u32(carts_ptr[0..carts_len], offset + 4);
            offset += 8;

            const product = catalog_find(product_id) orelse continue;

            temp_cart.items[temp_cart.item_count] = CartItem{
                .product_id = product_id,
                .quantity = qty,
                .price_snapshot = product.price,
            };
            temp_cart.item_count += 1;
        }

        // Read tax region
        if (offset >= carts_len) break;
        const tax_region = read_u8(carts_ptr[0..carts_len], offset);
        offset += 1;

        // Calculate subtotal
        i = 0;
        while (i < temp_cart.item_count) : (i += 1) {
            const item = &temp_cart.items[i];
            temp_cart.subtotal += item.price_snapshot * @as(f64, @floatFromInt(item.quantity));
        }

        // Apply discounts (use global rules)
        const saved_cart = global_cart;
        global_cart = temp_cart;
        _ = apply_discounts(rules_ptr, rules_len);
        temp_cart = global_cart;
        global_cart = saved_cart;

        // Calculate tax
        const after_discount = temp_cart.subtotal - temp_cart.discount_amount;
        temp_cart.tax_amount = calculate_tax(after_discount, 0.0, tax_region);

        // Calculate total
        temp_cart.total = after_discount + temp_cart.tax_amount;

        // Write result
        const res_offset = result_offset + 4 + (result_idx * 32);
        write_f64(memory_buffer[res_offset..], 0, temp_cart.subtotal);
        write_f64(memory_buffer[res_offset..], 8, temp_cart.discount_amount);
        write_f64(memory_buffer[res_offset..], 16, temp_cart.tax_amount);
        write_f64(memory_buffer[res_offset..], 24, temp_cart.total);
    }

    return result_offset;
}

// ============================================================================
// LEGACY FUNCTIONS (backward compatibility)
// ============================================================================

/// Menghitung total akhir berdasarkan subtotal, pajak (%), dan diskon (%)
/// Dipanggil oleh JS: wasmExports.calculate_total(subtotal, taxRate, discountRate)
export fn calculate_total(subtotal: f64, tax_rate: f64, discount_rate: f64) f64 {
    // 1. Hitung jumlah diskon
    const discount_amount = subtotal * (discount_rate / 100.0);
    const after_discount = subtotal - discount_amount;

    // 2. Hitung pajak dari nilai setelah diskon
    const tax_amount = after_discount * (tax_rate / 100.0);

    // 3. Total akhir
    return after_discount + tax_amount;
}

/// Fungsi benchmark untuk membandingkan performa WASM vs JS
/// REWRITTEN: Heavy workload — nested loops, struct allocation, hash lookup, sorting
/// Dipanggil oleh JS: wasmExports.compute_benchmark(iterations)
export fn compute_benchmark(iterations: u32) f64 {
    var acc: f64 = 0.0;
    var i: u32 = 0;

    // Phase 1: Nested loops with math operations
    while (i < iterations) : (i += 1) {
        var j: u32 = 0;
        while (j < 100) : (j += 1) {
            const x = @as(f64, @floatFromInt(i * j + 1));
            const y = @sqrt(x);
            acc += y * 1.0001;
            acc = @mod(acc, 10000.0);
        }
    }

    // Phase 2: Struct operations (simulate cart operations)
    var temp_items: [32]CartItem = undefined;
    i = 0;
    while (i < 32) : (i += 1) {
        temp_items[i] = CartItem{
            .product_id = i,
            .quantity = i % 10 + 1,
            .price_snapshot = @as(f64, @floatFromInt(i)) * 1000.0 + 500.0,
        };
    }

    // Phase 3: Sorting simulation (bubble sort on price_snapshot)
    var sorted = false;
    while (!sorted) {
        sorted = true;
        i = 0;
        while (i < 31) : (i += 1) {
            if (temp_items[i].price_snapshot > temp_items[i + 1].price_snapshot) {
                const temp = temp_items[i];
                temp_items[i] = temp_items[i + 1];
                temp_items[i + 1] = temp;
                sorted = false;
            }
        }
    }

    // Phase 4: Accumulate sorted prices
    i = 0;
    while (i < 32) : (i += 1) {
        acc += temp_items[i].price_snapshot * @as(f64, @floatFromInt(temp_items[i].quantity));
    }

    // Phase 5: Hash lookup simulation (if catalog has items)
    if (catalog_count > 0) {
        i = 0;
        while (i < 1000) : (i += 1) {
            const lookup_id = i % 512;
            _ = catalog_find(lookup_id);
        }
    }

    return acc;
}

/// Benchmark cart operations — add/remove/update cycles
/// Measures real cart manipulation performance
export fn benchmark_cart_operations(iterations: u32) f64 {
    var acc: f64 = 0.0;
    var i: u32 = 0;

    while (i < iterations) : (i += 1) {
        // Init cart
        cart_init();

        // Add 20 items
        var j: u32 = 0;
        while (j < 20) : (j += 1) {
            const product_id = j % 512;
            _ = cart_add_item(product_id, j % 5 + 1);
        }

        // Update 10 items
        j = 0;
        while (j < 10) : (j += 1) {
            _ = cart_update_qty(j, (j % 3) + 2);
        }

        // Remove 5 items
        j = 0;
        while (j < 5) : (j += 1) {
            _ = cart_remove_item(0); // Always remove first
        }

        // Calculate totals
        var k: u32 = 0;
        var subtotal: f64 = 0.0;
        while (k < global_cart.item_count) : (k += 1) {
            subtotal += global_cart.items[k].price_snapshot * @as(f64, @floatFromInt(global_cart.items[k].quantity));
        }

        acc += subtotal;
    }

    return acc;
}

/// Benchmark catalog queries — hash lookup stress test
export fn benchmark_catalog_query(iterations: u32) u32 {
    var hits: u32 = 0;
    var i: u32 = 0;

    while (i < iterations) : (i += 1) {
        var j: u32 = 0;
        while (j < 512) : (j += 1) {
            const product = catalog_find(j);
            if (product != null) hits += 1;
        }
    }

    return hits;
}

/// Menghitung kembalian (change)
/// Dipanggil oleh JS: wasmExports.calculate_change(total, paid)
export fn calculate_change(total: f64, paid: f64) f64 {
    if (paid < total) return 0.0;
    return paid - total;
}

/// Contoh fungsi untuk menerima array dari JS (Pointer ke memory WASM)
/// Dipanggil oleh JS: wasmExports.calculate_subtotal_array(pricesPtr, len)
export fn calculate_subtotal_array(prices_ptr: [*]const f64, len: usize) f64 {
    var subtotal: f64 = 0.0;
    var i: usize = 0;

    while (i < len) : (i += 1) {
        subtotal += prices_ptr[i];
    }

    return subtotal;
}
