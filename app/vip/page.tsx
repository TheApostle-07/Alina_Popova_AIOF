import { VipAuctionBoard } from "@/components/vip/vip-auction-board";
import { requireActiveMemberPage } from "@/lib/auth/guards";
import { getVipAuctionBoardForMember } from "@/lib/vip-service";

export const dynamic = "force-dynamic";

export default async function VipPage() {
  const member = await requireActiveMemberPage();
  const initialData = await getVipAuctionBoardForMember(member.memberId);

  return <VipAuctionBoard initialData={initialData} />;
}
