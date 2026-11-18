import { supabase } from "./supabaseClient";

const ORGANIZATION_CODE = "BAUERE";

async function getOrganizationId() {
  const { data, error } = await supabase
    .from("organizations")
    .select("id")
    .eq("code", ORGANIZATION_CODE)
    .single();

  if (error) throw error;
  if (!data?.id) throw new Error("Bauer organization was not found.");
  return data.id;
}

export async function loadOrganizationModuleData(moduleKey, fallback = null) {
  if (!/^[a-zA-Z][a-zA-Z0-9_]{1,80}$/.test(moduleKey)) {
    throw new Error("Invalid module key.");
  }

  // Read only the requested JSON setting. Loading the complete organization
  // settings object becomes expensive once recruitment documents and master
  // data grow, which can cause Supabase statement timeouts.
  const { data, error } = await supabase
    .from("organizations")
    // Alias the JSON path so the response contains only the requested value.
    .select(`id, moduleData:settings->${moduleKey}`)
    .eq("code", ORGANIZATION_CODE)
    .single();

  if (!error) {
    if (data && Object.prototype.hasOwnProperty.call(data, "moduleData")) {
      return data.moduleData ?? fallback;
    }
    // Keep compatibility with PostgREST versions that return the selected
    // JSON path under its source column name instead of the alias.
    if (data && Object.prototype.hasOwnProperty.call(data, moduleKey)) {
      return data[moduleKey] ?? fallback;
    }
    if (data && Object.prototype.hasOwnProperty.call(data, "settings")) {
      const selected = data.settings;
      if (selected && typeof selected === "object" && Object.prototype.hasOwnProperty.call(selected, moduleKey)) {
        return selected[moduleKey] ?? fallback;
      }
      return selected ?? fallback;
    }
    return fallback;
  }

  // Keep a clear error for the caller. Do not retry the old full-settings
  // query because that is the operation that causes the timeout.
  throw error;
}

export async function saveOrganizationModuleData(moduleKey, moduleData) {
  if (!/^[a-zA-Z][a-zA-Z0-9_]{1,80}$/.test(moduleKey)) {
    throw new Error("Invalid module key.");
  }

  const organizationId = await getOrganizationId();
  const { error } = await supabase.rpc("save_organization_module_data", {
    target_organization_id: organizationId,
    module_key: moduleKey,
    module_data: moduleData,
  });

  if (error) throw error;

  window.dispatchEvent(
    new CustomEvent("organizationModuleDataUpdated", {
      detail: {
        organizationId,
        moduleKey,
        updatedAt: new Date().toISOString(),
      },
    })
  );

  return moduleData;
}
