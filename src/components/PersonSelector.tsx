import { useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ChevronDown, Check } from "lucide-react";

interface Person {
  id: string;
  name: string;
}

interface Props {
  people: Person[];
  personId: string;
  setPersonId: (id: string) => void;
  newName: string;
  setNewName: (name: string) => void;
  disabled?: boolean;
}

export function PersonSelector({ people, personId, setPersonId, newName, setNewName, disabled }: Props) {
  const [open, setOpen] = useState(false);
  const selectedPerson = people.find((p) => p.id === personId);

  if (disabled) {
    return <Input value={selectedPerson?.name ?? ""} disabled />;
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" role="combobox" className="w-full justify-between font-normal">
          {selectedPerson ? selectedPerson.name : (newName || "اختر أو أضف اسماً جديداً")}
          <ChevronDown className="size-4 opacity-60" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
        <Command>
          <CommandInput
            placeholder="ابحث أو اكتب اسماً جديداً..."
            value={newName}
            onValueChange={(v) => {
              setNewName(v);
              setPersonId("");
            }}
          />
          <CommandList>
            <CommandEmpty>
              <div className="text-sm">سيُنشأ شخص جديد باسم "{newName}"</div>
            </CommandEmpty>
            <CommandGroup>
              {people.map((p) => (
                <CommandItem
                  key={p.id}
                  value={p.name}
                  onSelect={() => {
                    setPersonId(p.id);
                    setNewName("");
                    setOpen(false);
                  }}
                >
                  <Check className={`size-4 ${personId === p.id ? "opacity-100" : "opacity-0"}`} />
                  {p.name}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
