import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Machine } from "@/types/machine";
import MachineCard from "@/components/MachineCard";
import { Smartphone, LogIn, Settings } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import type { User } from "@supabase/supabase-js";

const Index = () => {
  const navigate = useNavigate();
  const [machines, setMachines] = useState<Machine[]>([]);
  const [user, setUser] = useState<User | null>(null);

  // Check authentication
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

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

  const handleSignOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <div className="min-h-screen p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <header className="text-center mb-8 md:mb-12 relative">
          <div className="absolute right-0 top-0 flex gap-2">
            <Button
              variant="outline"
              size="icon"
              onClick={() => navigate("/admin")}
              title="Admin Panel"
            >
              <Settings className="w-5 h-5" />
            </Button>
            {user ? (
              <Button variant="outline" onClick={handleSignOut}>
                Sign Out
              </Button>
            ) : (
              <Button variant="default" onClick={() => navigate("/auth")}>
                <LogIn className="w-4 h-4 mr-2" />
                Login
              </Button>
            )}
          </div>
          
          <h1 className="text-4xl md:text-5xl font-bold mb-3 text-foreground">
            Laundry Room
          </h1>
          <div className="flex items-center justify-center gap-2 text-muted-foreground">
            <Smartphone className="w-5 h-5" />
            <p className="text-lg">{user ? "Select a machine or scan QR code" : "Login to start"}</p>
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
    </div>
  );
};

export default Index;
