"use client"

import * as React from "react"
import { ThemeProvider as NextThemesProvider } from "next-themes"

/**
 * Light and dark mode from the system setting, on the `.dark` class the theme's CSS variables
 * read. The single-key "d" toggle from the shadcn template is left out: a one-letter shortcut
 * that cannot be turned off fails WCAG 2.2 SC 2.1.4 (Character Key Shortcuts).
 */
function ThemeProvider({
  children,
  ...props
}: React.ComponentProps<typeof NextThemesProvider>) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
      {...props}
    >
      {children}
    </NextThemesProvider>
  )
}

export { ThemeProvider }
