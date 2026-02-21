import { connectToDatabase } from "@/lib/db";
import { SiteSettingModel } from "@/lib/models/site-setting";

export type PublicSiteSettings = {
  ageModeEnabled: boolean;
};

export const defaultPublicSiteSettings: PublicSiteSettings = {
  ageModeEnabled: true
};

const GLOBAL_SETTINGS_KEY = "global";

export async function getPublicSiteSettings(): Promise<PublicSiteSettings> {
  await connectToDatabase();

  const setting = (await SiteSettingModel.findOne({ key: GLOBAL_SETTINGS_KEY })
    .select({ ageModeEnabled: 1 })
    .lean()) as { ageModeEnabled?: boolean } | null;

  if (!setting) {
    return defaultPublicSiteSettings;
  }

  return {
    ageModeEnabled:
      typeof setting.ageModeEnabled === "boolean"
        ? setting.ageModeEnabled
        : defaultPublicSiteSettings.ageModeEnabled
  };
}

export async function updatePublicSiteSettings(input: PublicSiteSettings) {
  await connectToDatabase();

  const updated = (await SiteSettingModel.findOneAndUpdate(
    { key: GLOBAL_SETTINGS_KEY },
    {
      $set: {
        ageModeEnabled: input.ageModeEnabled,
        updatedBy: "admin"
      },
      $setOnInsert: {
        key: GLOBAL_SETTINGS_KEY
      }
    },
    {
      new: true,
      upsert: true
    }
  )
    .select({ ageModeEnabled: 1 })
    .lean()) as { ageModeEnabled?: boolean } | null;

  return {
    ageModeEnabled:
      typeof updated?.ageModeEnabled === "boolean"
        ? updated.ageModeEnabled
        : defaultPublicSiteSettings.ageModeEnabled
  };
}
