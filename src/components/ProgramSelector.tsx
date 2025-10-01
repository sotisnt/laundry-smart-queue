import { Program, Machine, WASH_PROGRAMS, DRY_PROGRAMS } from "@/types/machine";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Clock } from "lucide-react";

interface ProgramSelectorProps {
  machine: Machine | null;
  open: boolean;
  onClose: () => void;
  onSelectProgram: (program: Program) => void;
}

const ProgramSelector = ({ machine, open, onClose, onSelectProgram }: ProgramSelectorProps) => {
  if (!machine) return null;

  const programs = machine.type === 'washer' ? WASH_PROGRAMS : DRY_PROGRAMS;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-2xl">Select Program</DialogTitle>
          <DialogDescription>
            Choose a {machine.type === 'washer' ? 'wash' : 'dry'} program for {machine.name}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3 mt-4">
          {programs.map((program) => (
            <Button
              key={program.id}
              variant="outline"
              className="h-auto p-4 justify-between hover:shadow-active transition-smooth"
              onClick={() => onSelectProgram(program)}
            >
              <div className="text-left">
                <p className="font-semibold text-base">{program.name}</p>
                <div className="flex items-center gap-1 mt-1">
                  <Clock className="w-3 h-3 text-muted-foreground" />
                  <p className="text-xs text-muted-foreground">{program.duration} minutes</p>
                </div>
              </div>
              <div className={`px-3 py-1 rounded-lg text-sm font-medium text-white ${
                machine.type === 'washer' ? 'gradient-washer' : 'gradient-dryer'
              }`}>
                Start
              </div>
            </Button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ProgramSelector;
