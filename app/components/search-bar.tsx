import { useEffect, useState } from 'react'
import { Search, X } from 'lucide-react'
import { Input } from '~/components/ui/input'
import { Button } from '~/components/ui/button'
import { useDebounce } from '~/hooks/use-debounce'

interface SearchBarProps {
  value: string
  onSearch: (query: string) => void
}

export function SearchBar({ value, onSearch }: SearchBarProps) {
  const [localValue, setLocalValue] = useState(value)
  const debouncedValue = useDebounce(localValue, 300)

  // Sync external value → local (e.g. browser back/forward)
  useEffect(() => {
    setLocalValue(value)
  }, [value])

  // Fire callback when debounced value changes
  useEffect(() => {
    if (debouncedValue !== value) {
      onSearch(debouncedValue)
    }
  }, [debouncedValue]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="relative">
      <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        type="text"
        placeholder="Rechercher une offre..."
        value={localValue}
        onChange={(e) => setLocalValue(e.target.value)}
        className="pl-9 pr-9"
      />
      {localValue && (
        <Button
          variant="ghost"
          size="icon-xs"
          className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground"
          onClick={() => {
            setLocalValue('')
            onSearch('')
          }}
        >
          <X className="size-3.5" />
        </Button>
      )}
    </div>
  )
}
