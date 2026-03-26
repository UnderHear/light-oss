"use client"

import {
  DatabaseIcon,
  ShieldCheckIcon,
} from "lucide-react"
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import { useI18n } from "@/lib/i18n"

export function NavProjects({
  connection,
}: {
  connection: {
    host: string
    tokenConfigured: boolean
  }
}) {
  const { t } = useI18n()

  return (
    <SidebarGroup className="group-data-[collapsible=icon]:hidden">
      <SidebarGroupLabel>{t("header.connection")}</SidebarGroupLabel>
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuButton tooltip={connection.host} variant="outline">
            <DatabaseIcon />
            <span>{connection.host}</span>
          </SidebarMenuButton>
        </SidebarMenuItem>
        <SidebarMenuItem>
          <SidebarMenuButton
            tooltip={
              connection.tokenConfigured
                ? t("header.authConfigured")
                : t("header.authMissing")
            }
          >
            <ShieldCheckIcon />
            <span>
              {connection.tokenConfigured
                ? t("header.authConfigured")
                : t("header.authMissing")}
            </span>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
    </SidebarGroup>
  )
}
