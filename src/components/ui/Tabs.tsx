import { useState, useRef, useCallback, type KeyboardEvent, type ReactNode } from 'react'

interface Tab {
  id: string
  label: string
  content: ReactNode
}

interface TabsProps {
  tabs: Tab[]
  defaultTab?: string
  className?: string
}

export default function Tabs({ tabs, defaultTab, className = '' }: TabsProps) {
  const [activeId, setActiveId] = useState(defaultTab ?? tabs[0]?.id ?? '')
  const tabRefs = useRef<Map<string, HTMLButtonElement>>(new Map())

  const setRef = useCallback(
    (id: string) => (el: HTMLButtonElement | null) => {
      if (el) tabRefs.current.set(id, el)
      else tabRefs.current.delete(id)
    },
    [],
  )

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLDivElement>) => {
      const currentIdx = tabs.findIndex((t) => t.id === activeId)
      let nextIdx = currentIdx

      if (e.key === 'ArrowRight') {
        nextIdx = (currentIdx + 1) % tabs.length
      } else if (e.key === 'ArrowLeft') {
        nextIdx = (currentIdx - 1 + tabs.length) % tabs.length
      } else if (e.key === 'Home') {
        nextIdx = 0
      } else if (e.key === 'End') {
        nextIdx = tabs.length - 1
      } else {
        return
      }

      e.preventDefault()
      const nextTab = tabs[nextIdx]
      setActiveId(nextTab.id)
      tabRefs.current.get(nextTab.id)?.focus()
    },
    [activeId, tabs],
  )

  const activeTab = tabs.find((t) => t.id === activeId) ?? tabs[0]

  return (
    <div className={className}>
      {/* Tab list */}
      <div
        role="tablist"
        aria-orientation="horizontal"
        onKeyDown={handleKeyDown}
        className="flex gap-1 border-b border-gray-200 dark:border-gray-700"
      >
        {tabs.map((tab) => {
          const selected = tab.id === activeId
          return (
            <button
              key={tab.id}
              ref={setRef(tab.id)}
              role="tab"
              id={`tab-${tab.id}`}
              aria-selected={selected}
              aria-controls={`tabpanel-${tab.id}`}
              tabIndex={selected ? 0 : -1}
              onClick={() => setActiveId(tab.id)}
              className={`-mb-px rounded-t-md px-4 py-2 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 ${
                selected
                  ? 'border-b-2 border-purple-600 text-purple-600 dark:border-purple-400 dark:text-purple-400'
                  : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
              }`}
            >
              {tab.label}
            </button>
          )
        })}
      </div>

      {/* Tab panel */}
      {activeTab && (
        <div
          role="tabpanel"
          id={`tabpanel-${activeTab.id}`}
          aria-labelledby={`tab-${activeTab.id}`}
          tabIndex={0}
          className="py-4"
        >
          {activeTab.content}
        </div>
      )}
    </div>
  )
}
