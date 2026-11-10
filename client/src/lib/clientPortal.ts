/*
 * SPAZEHAUS — Client portal data layer
 *
 * Hooks + helpers for the `/portal/:token` public route. Mirrors what the
 * `get_client_portal_data(token)` Postgres RPC returns + the
 * `client-portal-photo` Edge Function for signed photo URLs.
 *
 * No imports of `useAuth` / staff-only queries — the portal must work
 * without a Supabase Auth session. The `anon` PostgREST role is enough.
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import type {
  CheckpointStatus,
  PaymentGate,
  SignatureKey,
  StagePhase,
  StageType,
} from "@/lib/lifecycleData";

// ─── Shapes returned by get_client_portal_data() ──────────────────────────

export interface ClientPortalProject {
  id: string;
  name: string;
  client_name: string;
  client_contact: string | null;
  client_email: string | null;
  type: string;
  property_type: string;
  location: string;
  size_sqft: number | null;
  budget: number | null;
  start_date: string;         // ISO YYYY-MM-DD
  target_date: string | null; // ISO YYYY-MM-DD
  status: string;
  progress: number;
  description: string | null;
  designer_name: string;
  pm_name: string;
}

export interface ClientPortalStage {
  id: string;
  label: string;
  order_index: number;
  phase: StagePhase;
  stage_type: StageType;
  payment_gate: PaymentGate | null;
  signature_key: SignatureKey | null;
}

export interface ClientPortalPayment {
  id: number;
  gate: number;
  label: string;
  amount: number;
  status: CheckpointStatus;
  due_date: string | null;
  collected_date: string | null;
  reference: string | null;
  instalment: number | null;
  of_instalments: number | null;
  notes: string | null;
}

export interface ClientPortalSignature {
  id: number;
  signature_key: string;
  label: string;
  group_name: "contract" | "drawing";
  status: CheckpointStatus;
  signed_date: string | null;
  signed_by: string | null;
  notes: string | null;
}

export interface ClientPortalPhoto {
  id: number;
  photo_date: string;          // ISO YYYY-MM-DD
  storage_path: string;
  uploaded_at: string;         // ISO timestamptz
  notes: string | null;
}

/** Weekly site report — the Flow 2 client-facing progress update (replaces the
 *  daily close-door photo grid). One row per ISO week (week_start = Monday). */
export interface ClientPortalSiteReport {
  week_start: string;          // ISO YYYY-MM-DD (Monday of the week)
  summary: string;
  updated_at: string;          // ISO timestamptz
}

export interface ClientPortalData {
  project: ClientPortalProject;
  lifecycle: {
    current: ClientPortalStage | null;
    all_stages: ClientPortalStage[];
  };
  payments: ClientPortalPayment[];
  signatures: ClientPortalSignature[];
  recent_photos: ClientPortalPhoto[];
  /** Weekly report summaries, newest first (last ~12 weeks). May be absent on
   *  portals served before the Flow 2 Phase 2 RPC — treat undefined as []. */
  recent_site_reports?: ClientPortalSiteReport[];
}

// ─── Hooks ────────────────────────────────────────────────────────────────

const qk = {
  portalData: (token: string) => ["client_portal", token] as const,
  portalPhotoUrl: (token: string, storagePath: string) =>
    ["client_portal_photo", token, storagePath] as const,
};

/** Fetch the full portal payload via the SECURITY DEFINER RPC. Returns null
 *  when the token is invalid (consumers should show a 404 in that case). */
export function useClientPortalData(token: string | undefined) {
  return useQuery({
    queryKey: qk.portalData(token ?? ""),
    enabled: Boolean(token),
    queryFn: async (): Promise<ClientPortalData | null> => {
      const safeToken = token ?? "";
      const { data, error } = await supabase.rpc("get_client_portal_data", {
        p_token: safeToken,
      });
      if (error) throw error;
      if (data == null) return null; // invalid token → 404
      // The RPC returns JSONB; the Supabase generated types model the return
      // value as `Json`. Cast at the boundary — every nested shape is fully
      // typed below.
      return data as unknown as ClientPortalData;
    },
  });
}

/** Mint a short-lived signed URL for one site photo via the
 *  client-portal-photo Edge Function. The function validates that the
 *  (token, storagePath) pair belongs to a real project before signing. */
export async function getClientPortalPhotoUrl(
  token: string,
  storagePath: string,
): Promise<string | null> {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  if (!supabaseUrl) return null;
  try {
    const res = await fetch(
      `${supabaseUrl}/functions/v1/client-portal-photo`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, storagePath }),
      },
    );
    if (!res.ok) return null;
    const json = (await res.json()) as { url?: string };
    return json.url ?? null;
  } catch {
    return null;
  }
}

/** TanStack-Query-cached version of the URL minter so a photo grid doesn't
 *  re-hit the Edge Function on every render. Cached for 30 min (the signed
 *  URL itself is valid for 60 min, so cache TTL stays comfortably below). */
export function useClientPortalPhotoUrl(
  token: string | undefined,
  storagePath: string | undefined,
) {
  return useQuery({
    queryKey: qk.portalPhotoUrl(token ?? "", storagePath ?? ""),
    enabled: Boolean(token && storagePath),
    staleTime: 30 * 60 * 1000,
    queryFn: async (): Promise<string | null> => {
      if (!token || !storagePath) return null;
      return getClientPortalPhotoUrl(token, storagePath);
    },
  });
}
