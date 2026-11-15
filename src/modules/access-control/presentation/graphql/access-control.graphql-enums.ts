import { registerEnumType } from "@nestjs/graphql";
import { Permission } from "@/modules/access-control/domain/permission";
import { UserGroup } from "@/modules/access-control/domain/user-group";

registerEnumType(Permission, {
  name: "Permission",
  description: "Capacidade verificada pela API.",
});

registerEnumType(UserGroup, {
  name: "UserGroup",
  description:
    "Perfil de acesso: Morador, Gestor, Portaria ou Administrador geral.",
  valuesMap: {
    USER: { description: "Morador" },
    ADMIN: { description: "Gestor" },
    CONCIERGE: { description: "Portaria" },
    ADMIN_MASTER: { description: "Administrador geral" },
  },
});
