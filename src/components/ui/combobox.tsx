
"use client"

import * as React from "react"
import { Check, ChevronsUpDown } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

export type ComboboxOption = {
  value: string
  label: string
}

interface ComboboxProps {
  options: ComboboxOption[]
  value?: string
  onValueChange: (value: string) => void
  placeholder?: string
  emptyText?: string
  className?: string
}

export function Combobox({
  options,
  value,
  onValueChange,
  placeholder = "Select an option...",
  emptyText = "No options found.",
  className,
}: ComboboxProps) {
  const [open, setOpen] = React.useState(false)
  const [inputValue, setInputValue] = React.useState(value || "");

  React.useEffect(() => {
    setInputValue(value || "");
  }, [value]);

  const handleSelect = (currentValue: string) => {
    const selectedOption = options.find(opt => opt.value.toLowerCase() === currentValue.toLowerCase());
    const finalValue = selectedOption ? selectedOption.value : currentValue;
    onValueChange(finalValue);
    setInputValue(selectedOption ? selectedOption.label : finalValue);
    setOpen(false)
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn("w-full justify-between font-normal", className)}
        >
          <span className="truncate">
          {value
            ? options.find((option) => option.value.toLowerCase() === value.toLowerCase() || option.label.toLowerCase() === value.toLowerCase())?.label || value
            : placeholder}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
        <Command
          filter={(value, search) => {
            const option = options.find(option => option.value === value);
            if (option?.label.toLowerCase().includes(search.toLowerCase())) return 1
            return 0
          }}
          shouldFilter={true}
        >
          <CommandInput 
            placeholder={placeholder}
            value={inputValue}
            onValueChange={setInputValue}
            onKeyDown={(e) => {
                if (e.key === 'Enter' && inputValue) {
                    handleSelect(inputValue);
                }
            }}
           />
          <CommandList>
            <CommandEmpty>
                {inputValue ? `No results found for "${inputValue}".` : emptyText}
                {inputValue && <Button variant="link" onClick={() => handleSelect(inputValue)}>Add "{inputValue}"</Button>}
            </CommandEmpty>
            <CommandGroup>
              {options.map((option) => (
                <CommandItem
                  key={option.value}
                  value={option.value}
                  onSelect={handleSelect}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      (value?.toLowerCase() === option.value.toLowerCase() || value?.toLowerCase() === option.label.toLowerCase()) ? "opacity-100" : "opacity-0"
                    )}
                  />
                  {option.label}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
