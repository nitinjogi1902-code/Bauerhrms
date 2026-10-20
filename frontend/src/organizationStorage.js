
import { supabase } from "./supabaseClient";

const ORGANIZATION_CODE = "BAUERE";

async function getOrganization() {
  const { data, error } = await supabase
    .from("organizations")
    .select("id, settings")
    .eq("code", ORGANIZATION_CODE)
    .single();

  if (error) throw error;

  if (!data?.id) {
    throw new Error("Bauer organization was not found.");
  }

  return data;
}

export async function loadOrganizationModuleData(
  moduleKey,
  fallback = null
) {
  const organization = await getOrganization();
  const settings = organization.settings || {};

  return Object.prototype.hasOwnProperty.call(settings, moduleKey)
    ? settings[moduleKey]
    : fallback;
}

export async function saveOrganizationModuleData(moduleKey, moduleData) {
  if (!/^[a-zA-Z][a-zA-Z0-9_]{1,80}$/.test(moduleKey)) {
    throw new Error("Invalid module key.");
  }

  const organization = await getOrganization();

  const { error } = await supabase.rpc(
    "save_organization_module_data",
    {
      target_organization_id: organization.id,
      module_key: moduleKey,
      module_data: moduleData,
    }
  );

  if (error) throw error;

  window.dispatchEvent(
    new CustomEvent("organizationModuleDataUpdated", {
      detail: {
        organizationId: organization.id,
        moduleKey,
        updatedAt: new Date().toISOString(),
      },
    })
  );

  return moduleData;
}

export async function loadOrganizationMasters(fallback = {}) {
  return await loadOrganizationModuleData(
    "bauerHrmsOrganizationMasters",
    fallback
  );
}

export async function saveOrganizationMasters(masters) {
  return await saveOrganizationModuleData(
    "bauerHrmsOrganizationMasters",
    masters
  );
}
