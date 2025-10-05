import { useState, useEffect } from "react";
import { Machine } from "@/types/machine";
import MachineCard from "@/components/MachineCard";
import QRCodeDisplay from "@/components/QRCodeDisplay";
import { useToast } from "@/hooks/use-toast";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { Lock, LogOut } from "lucide-react";
import { useNavigate } from "react-router-dom";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const Admin = () => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState("");
  const [machines, setMachines] = useState<Machine[]>([]);
  const [usageRecords, setUsageRecords] = useState<any[]>([]);

  useEffect(() => {
    const adminAuth = sessionStorage.getItem("adminAuth");
    if (adminAuth === "laundry") {
      setIsAuthenticated(true);
    }
  }, []);

  useEffect(() => {
    if (!isAuthenticated) return;

    const fetchData = async () => {
      // Fetch machines
      const { data: machinesData, error: machinesError } = await supabase
        .from('machines')
        .select('*')
        .order('id');

      if (machinesError) {
        console.error('Error fetching machines:', machinesError);
      } else if (machinesData) {
        setMachines(machinesData.map(m => ({
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

      // Fetch usage records
      const { data: usageData, error: usageError } = await supabase
        .from('machine_usage')
        .select('*')
        .order('start_time', { ascending: false })
        .limit(50);

      if (usageError) {
        console.error('Error fetching usage:', usageError);
      } else if (usageData) {
        setUsageRecords(usageData);
      }
    };

    fetchData();

    // Subscribe to real-time updates
    const machinesChannel = supabase
      .channel('admin-machines-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'machines' },
        () => fetchData()
      )
      .subscribe();

    const usageChannel = supabase
      .channel('admin-usage-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'machine_usage' },
        () => fetchData()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(machinesChannel);
      supabase.removeChannel(usageChannel);
    };
  }, [isAuthenticated]);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (password === "laundry") {
      sessionStorage.setItem("adminAuth", "laundry");
      setIsAuthenticated(true);
      toast({
        title: "Access Granted",
        description: "Welcome to the admin panel",
      });
    } else {
      toast({
        title: "Access Denied",
        description: "Incorrect password",
        variant: "destructive"
      });
    }
  };

  const handleLogout = () => {
    sessionStorage.removeItem("adminAuth");
    setIsAuthenticated(false);
    setPassword("");
  };

  const handleStopMachine = async (machine: Machine) => {
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
        description: "Failed to stop the machine",
        variant: "destructive"
      });
      return;
    }

    // Update usage record with end time
    await supabase
      .from('machine_usage')
      .update({ end_time: new Date().toISOString() })
      .eq('machine_id', machine.id)
      .is('end_time', null);

    toast({
      title: "Machine Stopped",
      description: `${machine.name} has been stopped`,
    });
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="p-8 w-full max-w-md">
          <div className="flex flex-col items-center gap-6">
            <Lock className="w-16 h-16 text-primary" />
            <h1 className="text-2xl font-bold">Admin Access</h1>
            <form onSubmit={handleLogin} className="w-full space-y-4">
              <Input
                type="password"
                placeholder="Enter password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <Button type="submit" className="w-full">
                Login
              </Button>
            </form>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-4xl font-bold">Admin Panel</h1>
          <div className="flex gap-4">
            <Button variant="outline" onClick={() => navigate("/")}>
              Public View
            </Button>
            <Button variant="outline" onClick={handleLogout}>
              <LogOut className="w-4 h-4 mr-2" />
              Logout
            </Button>
          </div>
        </div>

        {/* QR Codes Section */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold mb-4">QR Codes</h2>
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
        <div className="mb-8">
          <h2 className="text-2xl font-bold mb-4">Machines</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {machines.map((machine) => (
              <MachineCard
                key={machine.id}
                machine={machine}
                onSelect={machine.status === 'in-use' ? () => handleStopMachine(machine) : undefined}
              />
            ))}
          </div>
        </div>

        {/* Usage Records */}
        <div>
          <h2 className="text-2xl font-bold mb-4">Usage History</h2>
          <Card className="p-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Machine</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Room</TableHead>
                  <TableHead>Program</TableHead>
                  <TableHead>Start Time</TableHead>
                  <TableHead>End Time</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {usageRecords.map((record) => (
                  <TableRow key={record.id}>
                    <TableCell>{record.machine_id}</TableCell>
                    <TableCell>{record.user_name}</TableCell>
                    <TableCell>{record.room_number}</TableCell>
                    <TableCell>{record.program_name}</TableCell>
                    <TableCell>
                      {new Date(record.start_time).toLocaleString()}
                    </TableCell>
                    <TableCell>
                      {record.end_time 
                        ? new Date(record.end_time).toLocaleString()
                        : "In Progress"
                      }
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Admin;
