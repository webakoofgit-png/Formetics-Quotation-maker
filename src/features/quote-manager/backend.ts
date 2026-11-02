import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import type { Member, Store } from "./model";

const db = supabase as unknown as SupabaseClient;
export const auth = () => db.auth;
export async function loadCloud(): Promise<{
  state: Store;
  revision: number;
  members: Member[];
  role: "Admin" | "Staff";
  workspace: string;
}> {
  const { data, error } = await db.rpc("formatix_load");
  if (error)
    throw new Error(
      `Cloud unavailable: ${error.message}. Apply the supplied Supabase migration before using cloud mode.`,
    );
  return data;
}
export async function createWorkspace(state: Store) {
  const { error } = await db.rpc("formatix_create", { initial_state: state });
  if (error) throw error;
  return loadCloud();
}
export async function saveCloud(state: Store, revision: number) {
  const { data, error } = await db.rpc("formatix_save", {
    next_state: state,
    expected_revision: revision,
  });
  if (error) throw new Error(error.message);
  return Number(data);
}
export async function setMember(email: string, name: string, role: string) {
  const { error } = await db.rpc("formatix_member", {
    member_email: email,
    member_name: name,
    member_role: role,
  });
  if (error) throw error;
}
export async function sharePdf(blob: Blob, workspace: string, id: string) {
  const path = `${workspace}/${id}/${crypto.randomUUID()}.pdf`;
  const { error } = await db.storage
    .from("formatix-quotes")
    .upload(path, blob, { contentType: "application/pdf", upsert: false });
  if (error) throw error;
  const result = await db.storage.from("formatix-quotes").createSignedUrl(path, 604800);
  if (result.error) throw result.error;
  return result.data.signedUrl;
}
