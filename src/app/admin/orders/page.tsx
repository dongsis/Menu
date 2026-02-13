"use client";
export const dynamic = "force-dynamic";

import React, { useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

function cents(n: number) {
  return (n / 100).toFixed(2);
}

export default function AdminOrdersPage() {
  const [sessionId, setSessionId] = useState("");
  const [adminToken, setAdminToken] = useState("");
  const [data, setData] = useState<any>(null);
  const [msg, setMsg] = useState("");

  if (!supabase) {
  return (
    <div style={{ maxWidth: 980, margin: "0 auto", padding: 16 }}>
      <h1>/admin/orders</h1>
      <div style={{ color: "#a00" }}>
        Supabase client is not initialized. Check NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY.
      </div>
    </div>
  );
}

  async function load() {
    setMsg("");

    const { data, error } = await supabase.rpc("rpc_admin_get_session_orders", {
      p_session_id: sessionId,
      p_admin_token: adminToken,
    });

    if (error) return setMsg(error.message);
    setData(data);
  }

  async function setLock(isLocked: boolean) {
    setMsg("");

    const { error } = await supabase.rpc("rpc_set_session_lock", {
      p_session_id: sessionId,
      p_admin_token: adminToken,
      p_is_locked: isLocked,
    });

    if (error) return setMsg(error.message);
    await load();
  }

  const totals = useMemo(() => {
    if (!data?.orders) return { grand: 0, byPerson: [] as any[] };

    const byPerson = data.orders.map((o: any) => {
      const items = o.items || [];
      const sum = items.reduce((acc: number, it: any) => {
        const base = (it.unit_base_price_cents || 0) * (it.qty || 0);
        const optDelta =
          (it.options || []).reduce((d: number, op: any) => d + (op.price_delta_cents || 0), 0) *
          (it.qty || 0);
        return acc + base + optDelta;
      }, 0);

      return { name: o.display_name, sum, updated_at: o.updated_at, items };
    });

    const grand = byPerson.reduce((acc: number, row: any) => acc + (row.sum || 0), 0);
    return { grand, byPerson };
  }, [data]);

  return (
    <div style={{ maxWidth: 980, margin: "0 auto", padding: 16 }}>
      <h1>/admin/orders</h1>

      <div style={{ border: "1px solid #ddd", padding: 12, borderRadius: 8, marginBottom: 16 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <div>
            <div style={{ fontWeight: 700 }}>Session ID</div>
            <input value={sessionId} onChange={(e) => setSessionId(e.target.value)} style={{ width: "100%" }} />
          </div>
          <div>
            <div style={{ fontWeight: 700 }}>Admin Token</div>
            <input value={adminToken} onChange={(e) => setAdminToken(e.target.value)} style={{ width: "100%" }} />
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
          <button onClick={load}>Load</button>
          <button onClick={() => setLock(true)}>Lock</button>
          <button onClick={() => setLock(false)}>Unlock</button>
        </div>

        <div style={{ marginTop: 8, color: "#a00" }}>{msg}</div>
      </div>

      {data?.session && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontWeight: 800 }}>
            {data.session.title} — Locked: {String(data.session.is_locked)}
          </div>
          <div style={{ opacity: 0.75 }}>Grand Total: ${cents(totals.grand)}</div>
        </div>
      )}

      {(totals.byPerson as Array<{ name: string; sum: number; updated_at: string; items: any[] }>).map((p) => (
        <div key={p.name} style={{ border: "1px solid #eee", padding: 12, borderRadius: 8, marginBottom: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 800 }}>
            <span>{p.name}</span>
            <span>${cents(p.sum)}</span>
          </div>

          {(p.items || []).map((it: any) => (
            <div key={it.order_item_id} style={{ marginTop: 8, paddingTop: 8, borderTop: "1px dashed #eee" }}>
              <div style={{ fontWeight: 700 }}>
                x{it.qty} — {it.title_en} / {it.title_zh}
              </div>

              {it.options?.length > 0 && (
                <div style={{ fontSize: 13, opacity: 0.85 }}>
                  Options:{" "}
                  {it.options
                    .map(
                      (op: any) =>
                        `${op.label_en}/${op.label_zh}${
                          op.price_delta_cents ? `(${cents(op.price_delta_cents)})` : ""
                        }`
                    )
                    .join(", ")}
                </div>
              )}

              {it.note && <div style={{ fontSize: 13, opacity: 0.85 }}>Note: {it.note}</div>}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
