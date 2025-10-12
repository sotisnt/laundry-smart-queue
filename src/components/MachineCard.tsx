import { Machine } from "@/types/machine";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { WashingMachine, Wind, Clock } from "lucide-react";
import { useEffect, useState } from "react";

interface MachineCardProps {
  machine: Machine;
  onSelect: (machine: Machine) => void;
}

const MachineCard = ({ machine, onSelect }: MachineCardProps) => {
  const [timeRemaining, setTimeRemaining] = useState<string>("");

  useEffect(() => {
    if (machine.status === 'in-use' && machine.endTime) {
      const interval = setInterval(() => {
        const now = new Date();
        const end = new Date(machine.endTime!);
        const diff = end.getTime() - now.getTime();

        if (diff <= 0) {
          setTimeRemaining("Done!");
          clearInterval(interval);
        } else {
          const minutes = Math.floor(diff / 60000);
          const seconds = Math.floor((diff % 60000) / 1000);
          setTimeRemaining(`${minutes}:${seconds.toString().padStart(2, '0')}`);
        }
      }, 1000);

      return () => clearInterval(interval);
    }
  }, [machine.status, machine.endTime]);

  const getStatusColor = () => {
    switch (machine.status) {
      case 'available':
        return 'bg-success';
      case 'in-use':
        return machine.type === 'washer' ? 'gradient-washer' : 'gradient-dryer';
      case 'done':
        return 'bg-destructive';
    }
  };

  const getStatusText = () => {
    switch (machine.status) {
      case 'available':
        return 'Available';
      case 'in-use':
        return 'In Use';
      case 'done':
        return 'Ready to Unload';
    }
  };

  const Icon = machine.type === 'washer' ? WashingMachine : Wind;

  return (
    <Card
      onClick={() => (machine.status === 'available' || machine.status === 'in-use') && onSelect(machine)}
      className={`
        relative overflow-hidden shadow-card transition-smooth
        ${machine.status === 'available' || machine.status === 'in-use' ? 'cursor-pointer hover:shadow-active hover:scale-105' : ''}
        ${machine.status === 'done' ? 'animate-pulse-glow' : ''}
      `}
    >
      <div className="p-6">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className={`p-3 rounded-xl ${getStatusColor()} ${machine.status === 'in-use' ? 'animate-spin-slow' : ''}`}>
              <Icon className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="font-bold text-lg text-card-foreground">{machine.name}</h3>
              <p className="text-sm text-muted-foreground capitalize">{machine.type}</p>
            </div>
          </div>
          <Badge
            variant={machine.status === 'available' ? 'default' : 'secondary'}
            className={`${getStatusColor()} text-white border-0`}
          >
            {getStatusText()}
          </Badge>
        </div>

        {/* Timer Display */}
        {machine.status === 'in-use' && (
          <div className="mt-4 p-4 rounded-lg bg-muted">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Time Remaining</span>
              </div>
              <span className="text-2xl font-bold text-card-foreground font-mono">
                {timeRemaining}
              </span>
            </div>
            {machine.currentProgram && (
              <p className="text-xs text-muted-foreground mt-2">
                Program: {machine.currentProgram.name}
              </p>
            )}
            <p className="text-xs text-muted-foreground mt-2 text-center">
              Tap to stop timer
            </p>
          </div>
        )}

        {/* Available State */}
        {machine.status === 'available' && (
          <div className="mt-4 p-4 rounded-lg bg-muted text-center">
            <p className="text-sm text-muted-foreground">Tap to start</p>
          </div>
        )}

        {/* Done State */}
        {machine.status === 'done' && (
          <div className="mt-4 p-4 rounded-lg bg-destructive/10 text-center">
            <p className="text-sm font-medium text-destructive">
              Please unload your laundry
            </p>
          </div>
        )}
      </div>
    </Card>
  );
};

export default MachineCard;
