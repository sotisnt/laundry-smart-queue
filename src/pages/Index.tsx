import { useState, useEffect } from "react";
import { Machine, Program } from "@/types/machine";
import MachineCard from "@/components/MachineCard";
import ProgramSelector from "@/components/ProgramSelector";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { QrCode } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

const Index = () => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [selectedMachine, setSelectedMachine] = useState<Machine | null>(null);
  const [showProgramSelector, setShowProgramSelector] = useState(false);
  const [machines, setMachines] = useState<Machine[]>([]);

  useEffect(() => {
    fetchMachines();
    
    // Subscribe to realtime changes
    const channel = supabase
      .channel('machines-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'machines'
        },
        () => {
          fetchMachines();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchMachines = async () => {
    const { data, error } = await supabase
      .from('machines')
      .select('*')
      .order('id');

    if (error) {
      console.error('Error fetching machines:', error);
    } else if (data) {
      setMachines(data.map(m => ({
        ...m,
        status: m.status as 'available' | 'in-use' | 'done',
        type: m.type as 'washer' | 'dryer',
        endTime: m.end_time ? new Date(m.end_time) : undefined,
        currentProgram: m.current_program_name ? {
          id: m.current_program_name,
          name: m.current_program_name,
          duration: m.current_program_duration || 45,
          type: m.type as 'washer' | 'dryer',
        } : undefined,
        canPostpone: m.can_postpone,
      })));
    }
  };

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
        can_postpone: null,
      })
      .eq('id', machine.id);

    if (error) {
      toast({
        title: "Error",
        description: "Failed to stop machine",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Timer Stopped",
        description: `${machine.name} timer has been cancelled.`,
      });
    }
  };

  const handleProgramSelect = async (program: Program) => {
    if (!selectedMachine) return;

    // Use 45 minutes as the fixed duration
    const duration = 45;
    const endTime = new Date();
    endTime.setMinutes(endTime.getMinutes() + duration);

    const { error } = await supabase
      .from('machines')
      .update({
        status: 'in-use',
        current_program_name: program.name,
        current_program_duration: duration,
        end_time: endTime.toISOString(),
        can_postpone: true,
      })
      .eq('id', selectedMachine.id);

    if (error) {
      toast({
        title: "Error",
        description: "Failed to start machine",
        variant: "destructive",
      });
      return;
    }

    toast({
      title: "Program Started",
      description: `${selectedMachine.name} is now running ${program.name} for ${duration} minutes.`,
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
    }, duration * 60 * 1000);
  };

  return (
    <div className="min-h-screen p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <header className="text-center mb-8 md:mb-12">
          <h1 className="text-4xl md:text-5xl font-bold mb-3 text-foreground">
            Laundry Room
          </h1>
          <p className="text-lg text-muted-foreground mb-4">
            View available machines and their status
          </p>
          <Button onClick={() => navigate('/qr-codes')} variant="outline">
            <QrCode className="w-4 h-4 mr-2" />
            View QR Codes
          </Button>
        </header>

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
