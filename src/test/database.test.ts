// Runs the real migration and RPCs on a disposable PostgreSQL WASM instance.
// Auth/storage schemas below simulate Supabase primitives; hosted auth/storage still require deployment verification.
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { describe, expect, it } from "vitest";
import { blankQuote, initialStore } from "@/features/quote-manager/model";

describe("Database authorization and atomic persistence", () => {
  it("applies migration, persists normalized quotes, rejects stale writes, enforces roles and isolates workspaces", async () => {
    const db = new PGlite();
    try {
      await db.exec(`create role anon; create role authenticated; create schema auth; create schema storage;
   create table auth.users(id uuid primary key,email text);
   create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
   create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
   create table storage.objects(id uuid default gen_random_uuid(),bucket_id text,name text);
   alter table storage.objects enable row level security;
   create function storage.foldername(text) returns text[] language sql immutable as $$select string_to_array($1,'/')$$;
   grant usage on schema auth,storage to authenticated;
   grant execute on function auth.uid() to authenticated;
   insert into auth.users values('00000000-0000-0000-0000-000000000001','owner@test.local'),('00000000-0000-0000-0000-000000000002','staff@test.local'),('00000000-0000-0000-0000-000000000003','other@test.local');`);
      await db.exec(readFileSync("supabase/migrations/202611020001_formatix.sql", "utf8"));
      const login = async (id: number) => {
        await db.query("select set_config('request.jwt.claim.sub',$1,false)", [
          `00000000-0000-0000-0000-00000000000${id}`,
        ]);
      };
      await login(1);
      const state = initialStore();
      state.services = state.services.map((s) => ({ ...s, id: crypto.randomUUID(), demo: false }));
      await db.query("select public.formatix_create($1::jsonb)", [JSON.stringify(state)]);
      const save = async (s: typeof state, revision: number) =>
        db.query("select public.formatix_save($1::jsonb,$2)", [JSON.stringify(s), revision]);
      // Creation deliberately strips demo catalog; the Admin configures it explicitly.
      const q = {
        ...blankQuote(),
        number: "FMT-TEST",
        customer: "Test Customer",
        phone: "9876543210",
        model: "SUV",
        staff: "owner@test.local",
        status: "Sent" as const,
        items: [
          {
            id: crypto.randomUUID(),
            serviceId: state.services[0]!.id,
            name: state.services[0]!.name,
            price: state.services[0]!.prices["Sedan"]!,
          },
        ],
        discount: 10000,
        booking: 50000,
      };
      state.quotes = [q];
      await save(state, 1);
      const row = await db.query<{
        subtotal_paise: number;
        total_paise: number;
        taxable_paise: number;
        gst_paise: number;
      }>("select * from public.formatix_quotations");
      expect(row.rows).toHaveLength(1);
      expect(Number(row.rows[0]!.taxable_paise) + Number(row.rows[0]!.gst_paise)).toBe(
        Number(row.rows[0]!.total_paise),
      );
      await expect(save(state, 1)).rejects.toThrow("another session");
      await db.query("select public.formatix_member('staff@test.local','Staff Member','Staff')");
      await login(2);
      await expect(
        save({ ...state, settings: { ...state.settings, company: "Unauthorized" } }, 2),
      ).rejects.toThrow("Only Admins");
      const tampered = {
        ...state,
        quotes: [{ ...q, items: q.items.map((i) => ({ ...i, price: 1 })) }],
      };
      await expect(save(tampered, 2)).rejects.toThrow("approved catalog");
      await save({ ...state, quotes: [{ ...q, status: "Booked" }] }, 2);
      await db.exec("set role authenticated");
      expect((await db.query("select * from public.formatix_quotations")).rows).toHaveLength(1);
      await expect(
        db.query("update public.formatix_members set role='Admin' where email='staff@test.local'"),
      ).rejects.toThrow("permission denied");
      await db.exec("reset role");
      await login(3);
      await db.query("select public.formatix_create($1::jsonb)", [JSON.stringify(initialStore())]);
      await db.exec("set role authenticated");
      expect((await db.query("select * from public.formatix_quotations")).rows).toHaveLength(0);
      const audit = await db.query("select * from public.formatix_audit_logs");
      expect(audit.rows).toHaveLength(1);
    } finally {
      await db.close();
    }
  }, 30000);
});
