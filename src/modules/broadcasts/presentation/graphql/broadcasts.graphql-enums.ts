import { registerEnumType } from "@nestjs/graphql";
import { BroadcastAudience } from "@/modules/broadcasts/domain/broadcast";

registerEnumType(BroadcastAudience, {
  name: "BroadcastAudience",
  description: "Quem recebe o comunicado.",
});
