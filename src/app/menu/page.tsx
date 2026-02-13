"use client";

import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type MenuSection = {
  id: string;
  sort: number;
  name_en: string;
  name_zh: string;
};

type MenuItem = {
  id: string;
  section_id: string;
  sort: number;
  title_en: string;
  title_zh: string;
  base_price_cents: number;
};

function cents(n: number) {
  return (n / 100).toFixed(2);
}

export default function MenuPage() {
  const [sections, setSections] = useState<MenuSection[]>([]);
  const [items, setItems] = useState<MenuItem[]>([]);
  const [cart, setCart] = useState<any[]>([]);

  // ✅ 姓名控制
  const [customerName, setCustomerName] = useState("");
  const canOrder = customerName.trim().length > 0;

  // ===== Salads Add-ons =====
  const SALAD_ADDONS = useMemo(
    () => [
      { name: "Chicken", price: 6 },
      { name: "Steak", price: 12 },
      { name: "Salmon", price: 10 },
      { name: "Shrimp", price: 9 },
      { name: "Tofu", price: 4 },
    ],
    []
  );
  const [saladAddons, setSaladAddons] = useState<{ name: string; price: number }[]>([]);

  // ===== Sandwich Side Dishes (+1 / +2) =====
  const SIDE_DISHES = useMemo(
    () => [
      { name: "Mixed Green Salad", price: 1 },
      { name: "Caesar Salad", price: 1 },
      { name: "French Fries", price: 1 },
      { name: "Sweet Potato Fries", price: 1 },
      { name: "Onion Rings", price: 1 },
      { name: "Daily Soup", price: 2 },
    ],
    []
  );
  const [sandwichSide, setSandwichSide] = useState<{ name: string; price: number } | null>(null);
  const [glutenFreeBun, setGlutenFreeBun] = useState(false); // +$2

  // ===== Pizza options =====
  const [glutenFreeCrust, setGlutenFreeCrust] = useState(false); // +$3

  // ---- Load menu ----
  useEffect(() => {
    async function load() {
      const s = await supabase.from("menu_sections").select("*").order("sort");
      const i = await supabase.from("menu_items").select("*").order("sort");
      if (s.data) setSections(s.data as any);
      if (i.data) setItems(i.data as any);
    }
    load();
  }, []);

  // ---- Helpers: classify section ----
  function isSalads(sec: MenuSection) {
    return sec.name_en.trim().toLowerCase() === "salads";
  }

  function isSandwiches(sec: MenuSection) {
    const n = sec.name_en.trim().toLowerCase();
    return n.includes("sandwich");
  }

  function isPizza(sec: MenuSection) {
    const n = sec.name_en.trim().toLowerCase();
    return n.includes("pizza");
  }

  function isSideDishesSection(sec: MenuSection) {
    const n = sec.name_en.trim().toLowerCase();
    return n === "side dishes" || n === "sides" || n.includes("side dishes");
  }

  // ---- Cart pricing ----
  function lineTotalCents(line: any) {
    return line.customPrice ? line.customPrice * line.qty : line.base_price_cents * line.qty;
  }

  // ---- Core: add to cart with section-specific extras ----
  function addToCart(item: MenuItem, sec: MenuSection) {
    if (!canOrder) return;

    let finalPrice = item.base_price_cents;
    const meta: any = {};

    // Salads: add-ons
    if (isSalads(sec)) {
      const addonsTotal = saladAddons.reduce((sum, a) => sum + a.price * 100, 0);
      finalPrice += addonsTotal;
      if (saladAddons.length) meta.saladAddons = saladAddons.map((a) => a.name);
      setSaladAddons([]);
    }

    // Sandwiches: side dish + GF bun
    if (isSandwiches(sec)) {
      if (sandwichSide) {
        finalPrice += sandwichSide.price * 100;
        meta.sideDish = sandwichSide.name;
        meta.sideDishPrice = sandwichSide.price;
      }
      if (glutenFreeBun) {
        finalPrice += 200;
        meta.glutenFreeBun = true;
      }
      setSandwichSide(null);
      setGlutenFreeBun(false);
    }

    // Pizza: GF crust
    if (isPizza(sec)) {
      if (glutenFreeCrust) {
        finalPrice += 300;
        meta.glutenFreeCrust = true;
      }
      setGlutenFreeCrust(false);
    }

    setCart((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        menuItemId: item.id,
        title: `${item.title_en} / ${item.title_zh}`,
        base_price_cents: item.base_price_cents,
        customPrice: finalPrice,
        qty: 1,
        meta,
      },
    ]);
  }

  function removeLine(id: string) {
    setCart((prev) => prev.filter((x: any) => x.id !== id));
  }

  return (
    <div className="cny-card" style={{ maxWidth: 980, margin: "40px auto", padding: 24 }}>
      <h1 style={{ textAlign: "center", color: "#b22222" }}>2026 ORC 新春联谊午餐</h1>

      {/* ✅ 姓名输入（无提示文案） */}
      <div style={{ marginTop: 18, marginBottom: 18, display: "flex", justifyContent: "center" }}>
        <div style={{ width: "min(720px, 100%)", display: "flex", gap: 10, alignItems: "center" }}>
          <div style={{ fontWeight: 600, whiteSpace: "nowrap" }}>Name / 姓名</div>
          <input
            value={customerName}
            onChange={(e) => setCustomerName(e.target.value)}
              style={{
              flex: 1,
              padding: "10px 12px",
              borderRadius: 10,
              border: "1px solid #ddd",
              outline: "none",
            }}
          />
        </div>
      </div>

      {/* ✅ 主菜单：隐藏独立 Side Dishes section */}
      {sections
        .filter((sec) => !isSideDishesSection(sec))
        .map((sec) => {
          const secItems = items
            .filter((it) => it.section_id === sec.id)
            .sort((a, b) => a.sort - b.sort);

          return (
            <div key={sec.id} style={{ marginBottom: 24 }}>
              <h2>
                {sec.name_en} / {sec.name_zh}
              </h2>

              {/* ✅ 先展示该大类的附加选项：放在标题下面 */}
              {isSalads(sec) && (
                <div
                  style={{
                    marginTop: 10,
                    marginBottom: 14,
                    padding: 12,
                    border: "1px solid #ddd",
                    borderRadius: 8,
                    background: "#fafafa",
                    opacity: canOrder ? 1 : 0.7,
                  }}
                >
                  <div style={{ fontWeight: 700, marginBottom: 6 }}>Add-ons (Optional) / 加料（可选）</div>

                  {SALAD_ADDONS.map((addon) => (
                    <label key={addon.name} style={{ display: "block", fontSize: 14 }}>
                      <input
                        type="checkbox"
                        checked={saladAddons.some((a) => a.name === addon.name)}
                        onChange={() => {
                          setSaladAddons((prev) => {
                            const exists = prev.find((a) => a.name === addon.name);
                            if (exists) return prev.filter((a) => a.name !== addon.name);
                            return [...prev, addon];
                          });
                        }}
                      />{" "}
                      {addon.name} (+${addon.price})
                    </label>
                  ))}

                  <div style={{ marginTop: 8, fontSize: 12, opacity: 0.75 }}>
                    Tip: Select add-ons first, then click “Add” on your salad.
                    <br />
                    提示：请先选择加料，然后点击对应沙拉的 “Add” 按钮。
                  </div>
                </div>
              )}

              {isSandwiches(sec) && (
                <div
                  style={{
                    marginTop: 10,
                    marginBottom: 14,
                    padding: 12,
                    border: "1px solid #ddd",
                    borderRadius: 8,
                    background: "#fafafa",
                    opacity: canOrder ? 1 : 0.7,
                  }}
                >
                  <div style={{ fontWeight: 700, marginBottom: 6 }}>Side Dishes / 配菜</div>

                  {SIDE_DISHES.map((sd) => (
                    <label key={sd.name} style={{ display: "block", fontSize: 14 }}>
                      <input
                        type="radio"
                        name="sandwich-side"
                        checked={sandwichSide?.name === sd.name}
                        onChange={() => setSandwichSide(sd)}
                      />{" "}
                      {sd.name} (+${sd.price})
                    </label>
                  ))}

                  <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid #e5e5e5" }}>
                    <label style={{ display: "block", fontSize: 14 }}>
                      <input
                        type="checkbox"
                        checked={glutenFreeBun}
                        onChange={(e) => setGlutenFreeBun(e.target.checked)}
                      />{" "}
                      Gluten Free Bun (+$2) / 无麸质面包 (+$2)
                    </label>
                  </div>

                  <div style={{ marginTop: 8, fontSize: 12, opacity: 0.75 }}>
                    Tip: Choose side dish / gluten free bun first, then click “Add” on your sandwich.
                    <br />
                    提示：请先选择配菜或无麸质面包，然后点击对应三明治的 “Add” 按钮。
                  </div>
                </div>
              )}

              {isPizza(sec) && (
                <div
                  style={{
                    marginTop: 10,
                    marginBottom: 14,
                    padding: 12,
                    border: "1px solid #ddd",
                    borderRadius: 8,
                    background: "#fafafa",
                    opacity: canOrder ? 1 : 0.7,
                  }}
                >
                  <div style={{ fontWeight: 700, marginBottom: 6 }}>Pizza Options / 披萨选项</div>

                  <label style={{ display: "block", fontSize: 14 }}>
                    <input
                      type="checkbox"
                      checked={glutenFreeCrust}
                      onChange={(e) => setGlutenFreeCrust(e.target.checked)}
                    />{" "}
                    Gluten Free Crust (+$3) / 无麸质饼底 (+$3)
                  </label>

                  <div style={{ marginTop: 8, fontSize: 12, opacity: 0.75 }}>
                    Tip: Select crust option first, then click “Add” on your pizza.
                    <br />
                    提示：请先选择饼底选项，然后点击对应披萨的 “Add” 按钮。
                  </div>
                </div>
              )}

              {/* ✅ 再显示该大类的菜品列表 */}
              {secItems.map((it) => (
                <div
                  key={it.id}
                  style={{
                    border: "1px solid #eee",
                    padding: 10,
                    borderRadius: 8,
                    marginBottom: 10,
                    display: "flex",
                    justifyContent: "space-between",
                    gap: 12,
                  }}
                >
                  <div style={{ fontWeight: 600 }}>
                    {it.title_en} / {it.title_zh}
                  </div>
                  <div style={{ whiteSpace: "nowrap" }}>
                    ${cents(it.base_price_cents)}
                    <button
                      style={{
                        marginLeft: 10,
                        opacity: canOrder ? 1 : 0.4,
                        cursor: canOrder ? "pointer" : "not-allowed",
                      }}
                      disabled={!canOrder}
                      onClick={() => addToCart(it, sec)}
                    >
                      Add
                    </button>
                  </div>
                </div>
              ))}
            </div>
          );
        })}

      {/* ===== Cart ===== */}
      <div style={{ marginTop: 40 }}>
        <h2>
          您的点餐：
          {customerName.trim() && (
            <span style={{ marginLeft: 8, color: "#b22222" }}>{customerName.trim()}</span>
          )}
        </h2>

        {cart.length === 0 && <div style={{ opacity: 0.7 }}>No items yet.</div>}

        {cart.map((line: any) => (
          <div
            key={line.id}
            style={{
              borderTop: "1px solid #ddd",
              paddingTop: 8,
              marginTop: 8,
              display: "flex",
              justifyContent: "space-between",
              gap: 12,
              alignItems: "flex-start",
            }}
          >
            <div>
              <div style={{ fontWeight: 600 }}>{line.title}</div>

              {line.meta?.saladAddons?.length ? (
                <div style={{ fontSize: 12, opacity: 0.75 }}>Add-ons: {line.meta.saladAddons.join(", ")}</div>
              ) : null}

              {line.meta?.sideDish ? (
                <div style={{ fontSize: 12, opacity: 0.75 }}>
                  Side: {line.meta.sideDish} (+${line.meta.sideDishPrice})
                </div>
              ) : null}

              {line.meta?.glutenFreeBun ? <div style={{ fontSize: 12, opacity: 0.75 }}>GF bun +$2</div> : null}
              {line.meta?.glutenFreeCrust ? <div style={{ fontSize: 12, opacity: 0.75 }}>GF crust +$3</div> : null}
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ fontWeight: 800 }}>${cents(lineTotalCents(line))}</div>

              <button
                onClick={() => removeLine(line.id)}
                style={{
                  background: "transparent",
                  border: "none",
                  fontSize: 18,
                  cursor: "pointer",
                  color: "#b22222",
                  lineHeight: 1,
                }}
                aria-label="Remove"
                title="Remove"
              >
                ×
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
