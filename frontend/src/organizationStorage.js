// Shared organization-master storage.
// Keep this file as a compatibility layer for older modules while all reads
// and writes use the timeout-safe targeted module storage implementation.
import {
  loadOrganizationModuleData,
  saveOrganizationModuleData,
} from "./organizationModuleStorage";

export { loadOrganizationModuleData, saveOrganizationModuleData };

const ORGANIZATION_MASTERS_KEY = "bauerHrmsOrganizationMasters";

export function loadOrganizationMasters(fallback = {}) {
  return loadOrganizationModuleData(ORGANIZATION_MASTERS_KEY, fallback);
}

export function saveOrganizationMasters(masters) {
  return saveOrganizationModuleData(ORGANIZATION_MASTERS_KEY, masters);
}
