import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import type { Machine } from "@/types/machine";
import { Program, WASH_PROGRAMS, DRY_PROGRAMS } from "@/types/machine";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";
import type { User } from "@supabase/supabase-js";
import { z } from "zod";

const userNameSchema = z.string()
  .min(1, "Name is required")
  .max(100, "Name must be less than 100 characters")
  .trim();

const roomNumberSchema = z.string()
  .min(1, "Room number is required")
  .max(10, "Room number must be less than 10 characters")
  .regex(/^[A-Za-z0-9-]+$/, "Room number can only contain letters, numbers, and hyphens")
  .trim();

const Machine = () => {
  const { machineId } = useParams<{ machineId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [user, setUser] = useState<User | null>(null);
  const [machine, setMachine] = useState<Machine | null>(null);
  const [userName, setUserName] = useState("");
  const [roomNumber, setRoomNumber] = useState("");
  const [selectedProgram, setSelectedProgram] = useState<Program | null>(null);
  const [loading, setLoading] = useState(true);
  const [errors, setErrors] = useState<{ userName?: string; roomNumber?: string }>({});

  // Check authentication
  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        toast({
          title: "Authentication Required",
          description: "Please log in to use the machines",
          variant: "destructive"
        });
        navigate("/auth");
        return;
      }

      setUser(session.user);
    };

    checkAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!session) {
        navigate("/auth");
      } else {
        setUser(session.user);
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate, toast]);

  useEffect(() => {
    if (!machineId || !user) return;

    const fetchMachine = async () => {
      const { data, error } = await supabase
        .from('machines')
        .select('*')
        .eq('id', machineId)
        .single();

      if (error) {
        console.error('Error fetching machine:', error);
        toast({
          title: "Error",
          description: "Machine not found",
          variant: "destructive"
        });
        navigate("/");
        return;
      }

      if (data) {
        setMachine({
          id: data.id,
          name: data.name,
          type: data.type as 'washer' | 'dryer',
          status: data.status as 'available' | 'in-use' | 'done',
          currentProgram: data.current_program_name ? {
            id: data.current_program_name.toLowerCase().replace(/\s+/g, '-'),
            name: data.current_program_name,
            duration: data.current_program_duration || 0,
            type: data.type as 'washer' | 'dryer'
          } : undefined,
          endTime: data.end_time ? new Date(data.end_time) : undefined,
          canPostpone: data.can_postpone
        });
      }
      setLoading(false);
    };

    fetchMachine();

    // Subscribe to real-time updates for this machine
    const channel = supabase
      .channel(`machine-${machineId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'machines',
          filter: `id=eq.${machineId}`
        },
        () => fetchMachine()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [machineId, user, navigate, toast]);

  const handleStartProgram = async () => {
    if (!machine || !selectedProgram || !user) {
      toast({
        title: "Missing Information",
        description: "Please fill in all fields",
        variant: "destructive"
      });
      return;
    }

    // Validate inputs
    const newErrors: { userName?: string; roomNumber?: string } = {};
    
    try {
      userNameSchema.parse(userName);
    } catch (error) {
      if (error instanceof z.ZodError) {
        newErrors.userName = error.errors[0].message;
      }
    }

    try {
      roomNumberSchema.parse(roomNumber);
    } catch (error) {
      if (error instanceof z.ZodError) {
        newErrors.roomNumber = error.errors[0].message;
      }
    }

    setErrors(newErrors);

    if (Object.keys(newErrors).length > 0) {
      toast({
        title: "Validation Error",
        description: "Please fix the errors in the form",
        variant: "destructive"
      });
      return;
    }

    if (machine.status !== 'available') {
      toast({
        title: "Machine Unavailable",
        description: "This machine is currently in use",
        variant: "destructive"
      });
      return;
    }

    const endTime = new Date();
    endTime.setMinutes(endTime.getMinutes() + selectedProgram.duration);

    // Update machine status
    const { error: updateError } = await supabase
      .from('machines')
      .update({
        status: 'in-use',
        current_program_name: selectedProgram.name,
        current_program_duration: selectedProgram.duration,
        end_time: endTime.toISOString(),
        can_postpone: true
      })
      .eq('id', machine.id);

    if (updateError) {
      toast({
        title: "Error",
        description: "Failed to start the program",
        variant: "destructive"
      });
      return;
    }

    // Record usage with user_id
    const { error: usageError } = await supabase
      .from('machine_usage')
      .insert({
        machine_id: machine.id,
        user_id: user.id,
        user_name: userName.trim(),
        room_number: roomNumber.trim(),
        program_name: selectedProgram.name,
        program_duration: selectedProgram.duration
      });

    if (usageError) {
      console.error('Error recording usage:', usageError);
    }

    toast({
      title: "Program Started",
      description: `${machine.name} is now running ${selectedProgram.name}`,
    });

    // Simulate completion
    setTimeout(async () => {
      await supabase
        .from('machines')
        .update({ status: 'done' })
        .eq('id', machine.id);

      await supabase
        .from('machine_usage')
        .update({ end_time: new Date().toISOString() })
        .eq('machine_id', machine.id)
        .is('end_time', null);
    }, selectedProgram.duration * 60 * 1000);

    navigate("/");
  };

  const handleStopProgram = async () => {
    if (!machine) return;

    const { error: updateError } = await supabase
      .from('machines')
      .update({
        status: 'available',
        current_program_name: null,
        current_program_duration: null,
        end_time: null,
        can_postpone: null
      })
      .eq('id', machine.id);

    if (updateError) {
      toast({
        title: "Error",
        description: "Failed to stop the program",
        variant: "destructive"
      });
      return;
    }

    // Update usage record
    await supabase
      .from('machine_usage')
      .update({ end_time: new Date().toISOString() })
      .eq('machine_id', machine.id)
      .is('end_time', null);

    toast({
      title: "Program Stopped",
      description: `${machine.name} has been stopped`,
    });

    navigate("/");
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  if (!machine) {
    return null;
  }

  const programs = machine.type === 'washer' ? WASH_PROGRAMS : DRY_PROGRAMS;

  // If machine is in use, show stop option
  if (machine.status === 'in-use') {
    return (
      <div className="min-h-screen p-4 md:p-8">
        <div className="max-w-2xl mx-auto">
          <h1 className="text-4xl font-bold mb-8 text-center">{machine.name}</h1>
          <Card className="p-8">
            <div className="text-center space-y-6">
              <p className="text-xl">This machine is currently in use</p>
              {machine.currentProgram && (
                <div className="space-y-2">
                  <p className="text-lg font-semibold">{machine.currentProgram.name}</p>
                  {machine.endTime && (
                    <p className="text-muted-foreground">
                      Ends at: {machine.endTime.toLocaleTimeString()}
                    </p>
                  )}
                </div>
              )}
              <Button onClick={handleStopProgram} variant="destructive" size="lg">
                Stop Program
              </Button>
              <Button onClick={() => navigate("/")} variant="outline" className="w-full">
                Back to Overview
              </Button>
            </div>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4 md:p-8">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-4xl font-bold mb-8 text-center">{machine.name}</h1>
        
        <Card className="p-6 space-y-6">
          <div className="space-y-4">
            <div>
              <Label htmlFor="userName">Your Name</Label>
              <Input
                id="userName"
                placeholder="Enter your name"
                value={userName}
                onChange={(e) => {
                  setUserName(e.target.value);
                  setErrors(prev => ({ ...prev, userName: undefined }));
                }}
                className={errors.userName ? "border-destructive" : ""}
              />
              {errors.userName && (
                <p className="text-sm text-destructive mt-1">{errors.userName}</p>
              )}
            </div>
            
            <div>
              <Label htmlFor="roomNumber">Room Number</Label>
              <Input
                id="roomNumber"
                placeholder="Enter your room number (e.g., 201, A-15)"
                value={roomNumber}
                onChange={(e) => {
                  setRoomNumber(e.target.value);
                  setErrors(prev => ({ ...prev, roomNumber: undefined }));
                }}
                className={errors.roomNumber ? "border-destructive" : ""}
              />
              {errors.roomNumber && (
                <p className="text-sm text-destructive mt-1">{errors.roomNumber}</p>
              )}
            </div>
          </div>

          <div className="space-y-3">
            <Label>Select Program</Label>
            <div className="grid gap-3">
              {programs.map((program) => (
                <Button
                  key={program.id}
                  variant={selectedProgram?.id === program.id ? "default" : "outline"}
                  className="justify-between h-auto p-4"
                  onClick={() => setSelectedProgram(program)}
                >
                  <span className="font-semibold">{program.name}</span>
                  <span>{program.duration} min</span>
                </Button>
              ))}
            </div>
          </div>

          <Button 
            onClick={handleStartProgram} 
            className="w-full" 
            size="lg"
            disabled={!userName.trim() || !roomNumber.trim() || !selectedProgram}
          >
            Start Program
          </Button>

          <Button onClick={() => navigate("/")} variant="outline" className="w-full">
            Cancel
          </Button>
        </Card>
      </div>
    </div>
  );
};

export default Machine;
