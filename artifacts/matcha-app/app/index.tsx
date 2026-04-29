import React from "react";

import { AdminOverviewScreen } from "@/components/admin/AdminScreens";
import { isAdminWebSurface } from "@/utils/adminHost";

export default function Entry() {
  if (isAdminWebSurface()) {
    return <AdminOverviewScreen />;
  }

  return null;
}
