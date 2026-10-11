import { supabase } from "./supabaseClient";

const ORGANIZATION_CODE = "BAUERE";
const MASTERS_KEY = "organizationMasters";

async function getOrganization() {
  const { data, error } = await supabase
    .from("organizations")
    .select("id, code, settings")
    .eq("code", ORGANIZATION_CODE)
    .single();

  if (error) {
    console.error("Unable to load organization:", error);
    throw error;
  }

  if (!data?.id) {
    throw new Error(`Organization ${ORGANIZATION_CODE} was not found.`);
  }

  return data;
}

/** Load Organization masters saved in organizations.settings.organizationMasters. */
export async function loadOrganizationMasters(defaultData = {}) {
  try {
    const organization = await getOrganization();
    const settings = organization?.settings && typeof organization.settings === "object"
      ? organization.settings
      : {};
    const savedMasters = settings[MASTERS_KEY];

    if (!savedMasters || typeof savedMasters !== "object" || Array.isArray(savedMasters)) {
      return defaultData;
    }

    return { ...defaultData, ...savedMasters };
  } catch (error) {
    console.error("Unable to load organization masters:", error);
    return defaultData;
  }
}

/** Save only the organizationMasters JSON key via the permission-checked RPC. */
export async function saveOrganizationMasters(data) {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new Error("Invalid organization master data; expected an object.");
  }

  const organization = await getOrganization();

  const { error } = await supabase.rpc("save_organization_masters", {
    target_organization_id: organization.id,
    masters_data: data,
  });

  if (error) {
    console.error("Unable to save organization masters to Supabase:", error);
    throw error;
  }

  const eventDetail = {
    organizationId: organization.id,
    updatedAt: new Date().toISOString(),
  };

  // Keep both event names during migration so all existing modules refresh.
  window.dispatchEvent(
    new CustomEvent("bauerHrmsOrganizationMastersUpdated", {
      detail: eventDetail,
    })
  );
  window.dispatchEvent(
    new CustomEvent("organizationMastersUpdated", {
      detail: eventDetail,
    })
  );

  return data;
}
