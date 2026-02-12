"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

export default function MenuTest() {
  const [msg, setMsg] = useState("Loading...");

  useEffect(() => {
    async function test() {
      const { data, error } = await supabase
        .from("menu_sections")
        .select("*")
        .limit(1);

      if (error) {
        setMsg("Error: " + error.message);
      } else {
        setMsg("Supabase connected. Sections count: " + data.length);
      }
    }
    test();
  }, []);

  return (
    <div style={{ padding: 40 }}>
      <h1>Ordering System</h1>
      <p>{msg}</p>
    </div>
  );
}
