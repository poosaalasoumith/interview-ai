"use client"

import * as React from "react"
import * as ResizablePrimitive from "react-resizable-panels"

import { cn } from "@/lib/utils"

const ResizablePanelGroup = ({
  className,
  ...props
}: React.ComponentProps<typeof ResizablePrimitive.Group>) => (
  <ResizablePrimitive.Group
    data-slot="resizable-panel-group"
    className={cn(
      "flex h-full w-full aria-[orientation=vertical]:flex-col",
      className
    )}
    {...props}
  />
)
ResizablePanelGroup.displayName = "ResizablePanelGroup"

const ResizablePanel = React.forwardRef<
  React.ElementRef<typeof ResizablePrimitive.Panel>,
  React.ComponentPropsWithoutRef<typeof ResizablePrimitive.Panel> & {
    onPanelCollapse?: () => void
    onPanelExpand?: () => void
  }
>((props, ref) => {
  const { className, onPanelCollapse, onPanelExpand, onResize, ...restProps } = props

  const handleResize = (
    panelSize: ResizablePrimitive.PanelSize,
    id: string | number | undefined,
    prevPanelSize: ResizablePrimitive.PanelSize | undefined
  ) => {
    if (onResize) {
      onResize(panelSize, id, prevPanelSize)
    }

    if (prevPanelSize !== undefined) {
      const wasCollapsed = prevPanelSize.asPercentage === 0
      const isCollapsed = panelSize.asPercentage === 0

      if (isCollapsed && !wasCollapsed && onPanelCollapse) {
        onPanelCollapse()
      } else if (!isCollapsed && wasCollapsed && onPanelExpand) {
        onPanelExpand()
      }
    }
  }

  return (
    <ResizablePrimitive.Panel
      panelRef={ref}
      data-slot="resizable-panel"
      onResize={onResize || onPanelCollapse || onPanelExpand ? handleResize : undefined}
      className={className}
      {...restProps}
    />
  )
})
ResizablePanel.displayName = "ResizablePanel"

const ResizableHandle = ({
  withHandle,
  className,
  ...props
}: React.ComponentProps<typeof ResizablePrimitive.Separator> & {
  withHandle?: boolean
}) => (
  <ResizablePrimitive.Separator
    data-slot="resizable-handle"
    className={cn(
      "relative flex w-px items-center justify-center bg-border ring-offset-background after:absolute after:inset-y-0 after:left-1/2 after:w-1 after:-translate-x-1/2 focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-hidden aria-[orientation=horizontal]:h-px aria-[orientation=horizontal]:w-full aria-[orientation=horizontal]:after:left-0 aria-[orientation=horizontal]:after:h-1 aria-[orientation=horizontal]:after:w-full aria-[orientation=horizontal]:after:translate-x-0 aria-[orientation=horizontal]:after:-translate-y-1/2 [&[aria-orientation=horizontal]>div]:rotate-90",
      className
    )}
    {...props}
  >
    {withHandle && (
      <div className="z-10 flex h-6 w-1 shrink-0 rounded-lg bg-border" />
    )}
  </ResizablePrimitive.Separator>
)
ResizableHandle.displayName = "ResizableHandle"

export { ResizableHandle, ResizablePanel, ResizablePanelGroup }
