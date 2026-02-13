"use client";

import React, { useEffect, useMemo, useState, useCallback } from "react";
import { supabase } from "@/lib/supabaseClient";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

type MenuSection = { id: string; sort: number; name_en: string; name_zh: string };
type MenuItem = {
  id: string;
  section_id: string;
  sort: number;
  title_en: string;
  title_zh: string;
  base_price_cents: number;
};
type OptionGroup = {
  id: string;
  name_en: string;
  name_zh: string;
  selection_type?: string; // 'single' | 'multi'
  sort: number;
};
type MenuOption = {
  id: string;
  group_id: string;
  label_en: string;
  label_zh: string;
  price_delta_cents: number;
  sort: number;
};
type CartItem = {
  id: string;
  menuItemId: string;
  titleEn: string;
  titleZh: string;
  basePriceCents: number;
  totalPriceCents: number;
  qty: number;
  optionIds: string[];
  optionLabels: string[];
  note: string;
};

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const SESSION_ID = "1766ff75-c964-43a6-a11a-232080e0eb29";

function cents(n: number) {
  return (n / 100).toFixed(2);
}

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

export default function MenuPage() {
  /* ---- menu data ---- */
  const [sections, setSections] = useState<MenuSection[]>([]);
  const [items, setItems] = useState<MenuItem[]>([]);
  const [optionGroups, setOptionGroups] = useState<OptionGroup[]>([]);
  const [allOptions, setAllOptions] = useState<MenuOption[]>([]);
  const [itemGroupLinks, setItemGroupLinks] = useState<{ menu_item_id: string; group_id: string }[]>([]);

  /* ---- cart ---- */
  const [cart, setCart] = useState<CartItem[]>([]);
  const [customerName, setCustomerName] = useState("");

  /* ---- per-item option selections (optionId set keyed by menuItemId) ---- */
  const [selectedOpts, setSelectedOpts] = useState<Record<string, Set<string>>>({});
  /* ---- per-item note (keyed by menuItemId) ---- */
  const [itemNotes, setItemNotes] = useState<Record<string, string>>({});

  /* ---- submit ---- */
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState("");

  const canOrder = customerName.trim().length > 0;

  /* ================================================================ */
  /*  Load all data                                                    */
  /* ================================================================ */

  useEffect(() => {
    (async () => {
      const [s, i, og, o, iog] = await Promise.all([
        supabase.from("menu_sections").select("*").order("sort"),
        supabase.from("menu_items").select("*").order("sort"),
        supabase.from("menu_option_groups").select("*"),
        supabase.from("menu_options").select("*"),
        supabase.from("menu_item_option_groups").select("*"),
      ]);
      if (s.data) setSections(s.data);
      if (i.data) setItems(i.data);
      if (og.data) setOptionGroups(og.data);
      if (o.data) setAllOptions(o.data);
      if (iog.data) setItemGroupLinks(iog.data);
    })();
  }, []);

  /* ================================================================ */
  /*  Build lookup: menuItemId → [{ group, options[] }]                */
  /* ================================================================ */

  const itemOptionsMap = useMemo(() => {
    const map = new Map<string, { group: OptionGroup; options: MenuOption[] }[]>();
    for (const link of itemGroupLinks) {
      const group = optionGroups.find((g) => g.id === link.group_id);
      if (!group) continue;
      const opts = allOptions
        .filter((o) => o.group_id === group.id)
        .sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0));
      if (!map.has(link.menu_item_id)) map.set(link.menu_item_id, []);
      map.get(link.menu_item_id)!.push({ group, options: opts });
    }
    for (const groups of map.values()) {
      groups.sort((a, b) => (a.group.sort ?? 0) - (b.group.sort ?? 0));
    }
    return map;
  }, [itemGroupLinks, optionGroups, allOptions]);

  /* ================================================================ */
  /*  Option selection                                                 */
  /* ================================================================ */

  function toggleOption(itemId: string, optId: string, groupId: string, isMulti: boolean) {
    setSelectedOpts((prev) => {
      const s = new Set(prev[itemId] || []);
      if (isMulti) {
        if (s.has(optId)) s.delete(optId);
        else s.add(optId);
      } else {
        // single-select: clear others in this group, then set
        const groupOptIds = allOptions.filter((o) => o.group_id === groupId).map((o) => o.id);
        for (const id of groupOptIds) s.delete(id);
        s.add(optId);
      }
      return { ...prev, [itemId]: s };
    });
  }

  /* ================================================================ */
  /*  Cart helpers                                                     */
  /* ================================================================ */

  function addToCart(item: MenuItem) {
    if (!canOrder) return;

    const sel = selectedOpts[item.id] || new Set<string>();
    const selOpts = allOptions.filter((o) => sel.has(o.id));
    const delta = selOpts.reduce((sum, o) => sum + o.price_delta_cents, 0);

    setCart((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        menuItemId: item.id,
        titleEn: item.title_en,
        titleZh: item.title_zh,
        basePriceCents: item.base_price_cents,
        totalPriceCents: item.base_price_cents + delta,
        qty: 1,
        optionIds: selOpts.map((o) => o.id),
        optionLabels: selOpts.map(
          (o) =>
            `${o.label_en}/${o.label_zh}${o.price_delta_cents ? ` (+$${cents(o.price_delta_cents)})` : ""}`
        ),
        note: (itemNotes[item.id] || "").trim(),
      },
    ]);

    // reset selections and note for this item
    setSelectedOpts((prev) => ({ ...prev, [item.id]: new Set() }));
    setItemNotes((prev) => ({ ...prev, [item.id]: "" }));
  }

  function removeLine(id: string) {
    setCart((prev) => prev.filter((x) => x.id !== id));
  }

  const cartTotal = useMemo(
    () => cart.reduce((sum, it) => sum + it.totalPriceCents * it.qty, 0),
    [cart]
  );

  /* ================================================================ */
  /*  Submit order                                                     */
  /* ================================================================ */

  const submitOrder = useCallback(async () => {
    if (!cart.length || !customerName.trim()) return;

    setSubmitting(true);
    setSubmitError("");

    try {
      // 1. create / get draft order
      const { data: orderData, error: orderError } = await supabase.rpc(
        "rpc_get_or_create_draft_order",
        {
          p_session_id: SESSION_ID,
          p_display_name: customerName.trim(),
        }
      );
      if (orderError) throw new Error(orderError.message);

      const { order_id, edit_token } = orderData;

      // 2. upsert each cart item
      for (const item of cart) {
        const { error } = await supabase.rpc("rpc_upsert_order_item", {
          p_order_id: order_id,
          p_edit_token: edit_token,
          p_order_item_id: null,
          p_menu_item_id: item.menuItemId,
          p_qty: item.qty,
          p_note: item.note,
          p_option_ids: item.optionIds,
        });
        if (error) throw new Error(error.message);
      }

      // success
      setSubmitted(true);
      setCart([]);
    } catch (err: any) {
      setSubmitError(err.message || "Failed to submit order");
    } finally {
      setSubmitting(false);
    }
  }, [cart, customerName]);

  /* ================================================================ */
  /*  Helpers                                                          */
  /* ================================================================ */

  function isSideDishesSection(sec: MenuSection) {
    const n = sec.name_en.trim().toLowerCase();
    return n === "side dishes" || n === "sides" || n.includes("side dishes");
  }

  /* ================================================================ */
  /*  Render: submitted success                                        */
  /* ================================================================ */

  if (submitted) {
    return (
      <div className="cny-card" style={{ maxWidth: 980, margin: "40px auto", padding: 24, textAlign: "center" }}>
        <h1 style={{ color: "#b22222" }}>2026 ORC 新春联谊午餐</h1>
        <div style={{ fontSize: 24, fontWeight: 800, marginTop: 40, color: "#228B22" }}>
          Order submitted! / 订单已提交！
        </div>
        <div style={{ marginTop: 16, opacity: 0.75 }}>
          {customerName.trim()}, your order has been received.
        </div>
        <button
          style={{ marginTop: 24, padding: "10px 24px", fontSize: 16, cursor: "pointer" }}
          onClick={() => setSubmitted(false)}
        >
          Order more / 继续点餐
        </button>
      </div>
    );
  }

  /* ================================================================ */
  /*  Render: main page                                                */
  /* ================================================================ */

  return (
    <div className="cny-card" style={{ maxWidth: 980, margin: "40px auto", padding: 24 }}>
      <h1 style={{ textAlign: "center", color: "#b22222" }}>2026 ORC 新春联谊午餐</h1>

      {/* ---- Name input ---- */}
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

      {/* ---- Menu sections ---- */}
      {sections
        .filter((sec) => !isSideDishesSection(sec))
        .map((sec) => {
          const secItems = items.filter((it) => it.section_id === sec.id).sort((a, b) => a.sort - b.sort);

          return (
            <div key={sec.id} style={{ marginBottom: 24 }}>
              <h2>
                {sec.name_en} / {sec.name_zh}
              </h2>

              {secItems.map((it) => {
                const groups = itemOptionsMap.get(it.id) || [];
                const sel = selectedOpts[it.id] || new Set<string>();

                return (
                  <div
                    key={it.id}
                    style={{
                      border: "1px solid #eee",
                      padding: 12,
                      borderRadius: 8,
                      marginBottom: 10,
                    }}
                  >
                    {/* item header: title + price */}
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                      <div style={{ fontWeight: 600 }}>
                        {it.title_en} / {it.title_zh}
                      </div>
                      <div style={{ whiteSpace: "nowrap", fontWeight: 600 }}>${cents(it.base_price_cents)}</div>
                    </div>

                    {/* option groups for this item */}
                    {groups.length > 0 && (
                      <div
                        style={{
                          marginTop: 8,
                          padding: 8,
                          background: "#fafafa",
                          borderRadius: 6,
                          opacity: canOrder ? 1 : 0.7,
                        }}
                      >
                        {groups.map(({ group, options: opts }) => {
                          const isMulti = group.selection_type !== "single";
                          return (
                            <div key={group.id} style={{ marginBottom: 6 }}>
                              <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 2 }}>
                                {group.name_en} / {group.name_zh}
                              </div>
                              {opts.map((opt) => (
                                <label key={opt.id} style={{ display: "block", fontSize: 13, cursor: "pointer" }}>
                                  <input
                                    type={isMulti ? "checkbox" : "radio"}
                                    name={isMulti ? undefined : `${it.id}-${group.id}`}
                                    checked={sel.has(opt.id)}
                                    onChange={() => toggleOption(it.id, opt.id, group.id, isMulti)}
                                    disabled={!canOrder}
                                  />{" "}
                                  {opt.label_en} / {opt.label_zh}
                                  {opt.price_delta_cents > 0 && ` (+$${cents(opt.price_delta_cents)})`}
                                </label>
                              ))}
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Note input */}
                    <div style={{ marginTop: 8 }}>
                      <input
                        placeholder="Note / 备注"
                        value={itemNotes[it.id] || ""}
                        onChange={(e) =>
                          setItemNotes((prev) => ({ ...prev, [it.id]: e.target.value }))
                        }
                        disabled={!canOrder}
                        style={{
                          width: "100%",
                          padding: "6px 8px",
                          fontSize: 13,
                          border: "1px solid #ddd",
                          borderRadius: 6,
                          outline: "none",
                          opacity: canOrder ? 1 : 0.5,
                        }}
                      />
                    </div>

                    {/* Add button */}
                    <div style={{ marginTop: 8, textAlign: "right" }}>
                      <button
                        disabled={!canOrder}
                        onClick={() => addToCart(it)}
                        style={{
                          opacity: canOrder ? 1 : 0.4,
                          cursor: canOrder ? "pointer" : "not-allowed",
                        }}
                      >
                        Add
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })}

      {/* ---- Cart ---- */}
      <div style={{ marginTop: 40 }}>
        <h2>
          您的点餐：
          {customerName.trim() && <span style={{ marginLeft: 8, color: "#b22222" }}>{customerName.trim()}</span>}
        </h2>

        {cart.length === 0 && <div style={{ opacity: 0.7 }}>No items yet.</div>}

        {cart.map((line) => (
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
              <div style={{ fontWeight: 600 }}>
                {line.titleEn} / {line.titleZh}
              </div>
              {line.optionLabels.length > 0 && (
                <div style={{ fontSize: 12, opacity: 0.75 }}>Options: {line.optionLabels.join(", ")}</div>
              )}
              {line.note && (
                <div style={{ fontSize: 12, opacity: 0.75 }}>Note: {line.note}</div>
              )}
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ fontWeight: 800 }}>${cents(line.totalPriceCents * line.qty)}</div>
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

        {/* ---- Total + Submit ---- */}
        {cart.length > 0 && (
          <div style={{ marginTop: 16, paddingTop: 12, borderTop: "2px solid #ddd" }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 800, fontSize: 18 }}>
              <span>Total / 合计</span>
              <span>${cents(cartTotal)}</span>
            </div>

            <button
              onClick={submitOrder}
              disabled={submitting}
              style={{
                marginTop: 12,
                width: "100%",
                padding: "12px 0",
                fontSize: 16,
                fontWeight: 800,
                background: "#b22222",
                color: "white",
                border: "none",
                borderRadius: 8,
                cursor: submitting ? "not-allowed" : "pointer",
                opacity: submitting ? 0.6 : 1,
              }}
            >
              {submitting ? "Submitting... / 提交中..." : "Submit Order / 提交订单"}
            </button>

            {submitError && <div style={{ marginTop: 8, color: "#a00" }}>{submitError}</div>}
          </div>
        )}
      </div>
    </div>
  );
}
