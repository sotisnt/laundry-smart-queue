import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Machine } from "@/types/machine";
import MachineCard from "@/components/MachineCard";
import { Smartphone, Settings } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const Index = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [machines, setMachines] = useState<Machine[]>([]);
  const [showAdminDialog, setShowAdminDialog] = useState(false);
  const [adminPassword, setAdminPassword] = useState("");

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

  const handleAdminLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (adminPassword === "laundry") {
      sessionStorage.setItem("adminAuth", "laundry");
      navigate("/admin");
    } else {
      toast({
        title: "Access Denied",
        description: "Incorrect password",
        variant: "destructive"
      });
      setAdminPassword("");
    }
  };


  return (
    <div className="min-h-screen p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <header className="text-center mb-8 md:mb-12 relative">
          <Button
            variant="outline"
            size="icon"
            className="absolute right-0 top-0"
            onClick={() => setShowAdminDialog(true)}
          >
            <Settings className="w-5 h-5" />
          </Button>
          
          <h1 className="text-4xl md:text-5xl font-bold mb-3 text-foreground">
            Laundry Room
          </h1>
          <div className="flex items-center justify-center gap-2 text-muted-foreground">
            <Smartphone className="w-5 h-5" />
            <p className="text-lg">Scan QR code to start</p>
          </div>
        </header>

        {/* Machines Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {machines.map((machine) => (
            <MachineCard
              key={machine.id}
              machine={machine}
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

      {/* Admin Login Dialog */}
      <Dialog open={showAdminDialog} onOpenChange={setShowAdminDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Admin Access</DialogTitle>
            <DialogDescription>
              Enter the admin password to access the control panel
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleAdminLogin} className="space-y-4">
            <div>
              <Label htmlFor="adminPassword">Password</Label>
              <Input
                id="adminPassword"
                type="password"
                placeholder="Enter admin password"
                value={adminPassword}
                onChange={(e) => setAdminPassword(e.target.value)}
                autoFocus
              />
            </div>
            <Button type="submit" className="w-full">
              Login
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Index;
