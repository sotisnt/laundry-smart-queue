import { useState } from "react";
import { Machine, Program } from "@/types/machine";
import MachineCard from "@/components/MachineCard";
import ProgramSelector from "@/components/ProgramSelector";
import QRCodeDisplay from "@/components/QRCodeDisplay";
import { useToast } from "@/hooks/use-toast";
import { Smartphone } from "lucide-react";

const Index = () => {
  const { toast } = useToast();
  const [selectedMachine, setSelectedMachine] = useState<Machine | null>(null);
  const [showProgramSelector, setShowProgramSelector] = useState(false);

  // Initialize machines
  const [machines, setMachines] = useState<Machine[]>([
    { id: 'w1', name: 'Washer 1', type: 'washer', status: 'available' },
    { id: 'w2', name: 'Washer 2', type: 'washer', status: 'available' },
    { id: 'w3', name: 'Washer 3', type: 'washer', status: 'available' },
    { id: 'd1', name: 'Dryer 1', type: 'dryer', status: 'available' },
    { id: 'd2', name: 'Dryer 2', type: 'dryer', status: 'available' },
  ]);

  const handleMachineSelect = (machine: Machine) => {
    if (machine.status === 'available') {
      setSelectedMachine(machine);
      setShowProgramSelector(true);
    } else if (machine.status === 'in-use') {
      handleStopMachine(machine);
    }
  };

  const handleStopMachine = (machine: Machine) => {
    setMachines(prev =>
      prev.map(m =>
        m.id === machine.id
          ? { ...m, status: 'available', currentProgram: undefined, endTime: undefined }
          : m
      )
    );

    toast({
      title: "Timer Stopped",
      description: `${machine.name} timer has been cancelled.`,
    });
  };

  const handleProgramSelect = (program: Program) => {
    if (!selectedMachine) return;

    const endTime = new Date();
    endTime.setMinutes(endTime.getMinutes() + program.duration);

    setMachines(prev =>
      prev.map(m =>
        m.id === selectedMachine.id
          ? {
              ...m,
              status: 'in-use',
              currentProgram: program,
              endTime,
              canPostpone: true,
            }
          : m
      )
    );

    toast({
      title: "Program Started",
      description: `${selectedMachine.name} is now running ${program.name} for ${program.duration} minutes.`,
    });

    setShowProgramSelector(false);
    setSelectedMachine(null);

    // Simulate completion
    setTimeout(() => {
      setMachines(prev =>
        prev.map(m =>
          m.id === selectedMachine.id
            ? { ...m, status: 'done' }
            : m
        )
      );

      toast({
        title: "Cycle Complete!",
        description: `${selectedMachine.name} has finished. Please unload your laundry.`,
        variant: "default",
      });
    }, program.duration * 60 * 1000);
  };

  return (
    <div className="min-h-screen p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <header className="text-center mb-8 md:mb-12">
          <h1 className="text-4xl md:text-5xl font-bold mb-3 text-foreground">
            Laundry Room
          </h1>
          <div className="flex items-center justify-center gap-2 text-muted-foreground">
            <Smartphone className="w-5 h-5" />
            <p className="text-lg">Scan QR code to start</p>
          </div>
        </header>

        {/* QR Codes Section */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold mb-4 text-center text-foreground">Machine QR Codes</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            {machines.map((machine) => (
              <QRCodeDisplay 
                key={machine.id} 
                machineId={machine.id} 
                machineName={machine.name}
              />
            ))}
          </div>
        </div>

        {/* Machines Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {machines.map((machine) => (
            <MachineCard
              key={machine.id}
              machine={machine}
              onSelect={handleMachineSelect}
            />
          ))}
        </div>

        {/* Footer Info */}
        <footer className="mt-12 text-center">
          <div className="inline-block p-6 rounded-2xl bg-card shadow-card">
            <p className="text-sm text-muted-foreground mb-2">
              Need help? Contact building management
            </p>
            <p className="text-xs text-muted-foreground">
              Available machines: {machines.filter(m => m.status === 'available').length} / {machines.length}
            </p>
          </div>
        </footer>
      </div>

      {/* Program Selector Modal */}
      <ProgramSelector
        machine={selectedMachine}
        open={showProgramSelector}
        onClose={() => {
          setShowProgramSelector(false);
          setSelectedMachine(null);
        }}
        onSelectProgram={handleProgramSelect}
      />
    </div>
  );
};

export default Index;
