import { supabase } from "./supabaseClient";

const ORGANIZATION_CODE = "BAUERE";
const MASTERS_KEY = "organizationMasters";

async function getOrganization() {
  const { data, error } = await supabase
    .from("organizations")
    .select("id, settings")
    .eq("code", ORGANIZATION_CODE)
    .single();

  if (error) {
    console.error("Unable to load organization:", error);
    throw error;
  }

  return data;
}

export async function loadOrganizationMasters(defaultData) {
  try {
    const organization = await getOrganization();

    const settings = organization?.settings || {};
    const savedMasters = settings?.[MASTERS_KEY];

    if (!savedMasters) {
      return defaultData;
    }

    return {
      ...defaultData,
      ...savedMasters,
    };
  } catch (error) {
    console.error("Unable to load organization masters:", error);
    return defaultData;
  }
}

export async function saveOrganizationMasters(data) {
  try {
    const organization = await getOrganization();

    const currentSettings = organization?.settings || {};

    const nextSettings = {
      ...currentSettings,
      [MASTERS_KEY]: data,
    };

    const { error } = await supabase
      .from("organizations")
      .update({
        settings: nextSettings,
        updated_at: new Date().toISOString(),
      })
      .eq("id", organization.id);

    if (error) {
      throw error;
    }
  } catch (error) {
    console.error("Unable to save organization masters:", error);
    throw error;
  }
}