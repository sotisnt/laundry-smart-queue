import { useState, useEffect } from "react";
import { Machine, Program } from "@/types/machine";
import MachineCard from "@/components/MachineCard";
import ProgramSelector from "@/components/ProgramSelector";
import QRCodeDisplay from "@/components/QRCodeDisplay";
import { useToast } from "@/hooks/use-toast";
import { Smartphone } from "lucide-react";
import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";

const Index = () => {
  const { toast } = useToast();
  const [selectedMachine, setSelectedMachine] = useState<Machine | null>(null);
  const [showProgramSelector, setShowProgramSelector] = useState(false);
  const [machines, setMachines] = useState<Machine[]>([]);

  // Fetch machines from database
  useEffect(() => {
    const fetchMachines = async () => {
      const { data, error } = await supabase
        .from('machines')
        .select('*')
        .order('id');

      if (error) {
        console.error('Error fetching machines:', error);
        return;
      }

      if (data) {
        setMachines(data.map(m => ({
          id: m.id,
          name: m.name,
          type: m.type as 'washer' | 'dryer',
          status: m.status as 'available' | 'in-use' | 'done',
          currentProgram: m.current_program_name ? {
            id: m.current_program_name.toLowerCase().replace(/\s+/g, '-'),
            name: m.current_program_name,
            duration: m.current_program_duration || 0,
            type: m.type as 'washer' | 'dryer'
          } : undefined,
          endTime: m.end_time ? new Date(m.end_time) : undefined,
          canPostpone: m.can_postpone
        })));
      }
    };

    fetchMachines();

    // Subscribe to real-time updates
    const channel = supabase
      .channel('machines-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'machines'
        },
        (payload) => {
          console.log('Real-time update:', payload);
          fetchMachines(); // Refetch on any change
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Handle QR code scanning
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const machineId = params.get('machine');
    
    if (machineId) {
      const machine = machines.find(m => m.id === machineId);
      if (machine) {
        handleMachineSelect(machine);
      }
      // Clear the URL parameter
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, [machines]);

  const handleMachineSelect = (machine: Machine) => {
    if (machine.status === 'available') {
      setSelectedMachine(machine);
      setShowProgramSelector(true);
    } else if (machine.status === 'in-use') {
      handleStopMachine(machine);
    }
  };

  const handleStopMachine = async (machine: Machine) => {
    const { error } = await supabase
      .from('machines')
      .update({
        status: 'available',
        current_program_name: null,
        current_program_duration: null,
        end_time: null,
        can_postpone: null
      })
      .eq('id', machine.id);

    if (error) {
      console.error('Error stopping machine:', error);
      toast({
        title: "Error",
        description: "Failed to stop the timer. Please try again.",
        variant: "destructive"
      });
      return;
    }

    toast({
      title: "Timer Stopped",
      description: `${machine.name} timer has been cancelled.`,
    });
  };

  const handleProgramSelect = async (program: Program) => {
    if (!selectedMachine) return;

    const endTime = new Date();
    endTime.setMinutes(endTime.getMinutes() + program.duration);

    // Update database
    const { error } = await supabase
      .from('machines')
      .update({
        status: 'in-use',
        current_program_name: program.name,
        current_program_duration: program.duration,
        end_time: endTime.toISOString(),
        can_postpone: true
      })
      .eq('id', selectedMachine.id);

    if (error) {
      console.error('Error updating machine:', error);
      toast({
        title: "Error",
        description: "Failed to start the program. Please try again.",
        variant: "destructive"
      });
      return;
    }

    toast({
      title: "Program Started",
      description: `${selectedMachine.name} is now running ${program.name} for ${program.duration} minutes.`,
    });

    setShowProgramSelector(false);
    setSelectedMachine(null);

    // Simulate completion
    setTimeout(async () => {
      await supabase
        .from('machines')
        .update({ status: 'done' })
        .eq('id', selectedMachine.id);

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
          <h2 className="text-2xl font-bold mb-4 text-center text-foreground">QR Codes</h2>
          
          {/* Home QR Code */}
          <div className="flex justify-center mb-6">
            <Card className="p-6 flex flex-col items-center gap-3 bg-primary/5">
              <QRCodeDisplay 
                machineId="" 
                machineName="View All Machines"
              />
              <p className="text-xs text-muted-foreground">Scan to see all timers</p>
            </Card>
          </div>

          {/* Machine QR Codes */}
          <h3 className="text-lg font-semibold mb-3 text-center text-muted-foreground">Individual Machines</h3>
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
