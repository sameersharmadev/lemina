"use client"

import { useTheme } from "next-themes"
import { Toaster as Sonner } from "sonner";
import { useSettings } from "@/lib/SettingsContext"; // Import useSettings

const Toaster = ({
  ...props
}) => {
  const { theme = "system" } = useTheme()
  const { settings } = useSettings(); // Get settings from context

  return (
    <Sonner
      theme={theme}
      className="toaster group"
      // Apply the duration from settings directly to the Toaster
      duration={settings.notificationDuration}
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)"
        }
      }
      {...props} />
  );
}

export { Toaster }
