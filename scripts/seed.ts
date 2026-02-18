import { connectToDatabase } from "../lib/db";
import { ContentModel } from "../lib/models/content";

async function seed() {
  await connectToDatabase();

  const now = new Date();
  const samples = [
    {
      type: "image",
      title: "Golden hour studio set",
      tags: ["studio", "exclusive"],
      status: "published",
      publishAt: new Date(now.getTime() - 6 * 60 * 60 * 1000),
      previewEligible: true,
      previewUrl: "https://res.cloudinary.com/demo/image/upload/e_blur:1400,q_30/sample.jpg",
      mediaAssetId: "sample"
    },
    {
      type: "image",
      title: "Night city mirror shots",
      tags: ["city", "night"],
      status: "published",
      publishAt: new Date(now.getTime() - 4 * 60 * 60 * 1000),
      previewEligible: true,
      previewUrl: "https://res.cloudinary.com/demo/image/upload/e_blur:1400,q_30/fashion_woman.jpg",
      mediaAssetId: "fashion_woman"
    },
    {
      type: "video",
      title: "Backstage short clip",
      tags: ["video", "backstage"],
      status: "published",
      publishAt: new Date(now.getTime() - 2 * 60 * 60 * 1000),
      previewEligible: true,
      previewUrl: "https://res.cloudinary.com/demo/video/upload/so_1,e_blur:1400,q_30/dog.jpg",
      mediaAssetId: "dog"
    },
    {
      type: "image",
      title: "Minimal black outfit board",
      tags: ["style", "editorial"],
      status: "published",
      publishAt: new Date(now.getTime() - 90 * 60 * 1000),
      previewEligible: true,
      previewUrl: "https://res.cloudinary.com/demo/image/upload/e_blur:1400,q_30/balloons.jpg",
      mediaAssetId: "balloons"
    },
    {
      type: "video",
      title: "Quick transition reel",
      tags: ["reel", "vip"],
      status: "scheduled",
      publishAt: new Date(now.getTime() + 90 * 60 * 1000),
      previewEligible: true,
      previewUrl: "https://res.cloudinary.com/demo/video/upload/so_1,e_blur:1400,q_30/dog.jpg",
      mediaAssetId: "dog"
    }
  ] as const;

  let inserted = 0;
  for (const item of samples) {
    const exists = await ContentModel.findOne({ title: item.title }).lean();
    if (exists) {
      continue;
    }

    await ContentModel.create(item);
    inserted += 1;
  }

  console.info(`Seed complete. Inserted ${inserted} content records.`);
}

seed()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
