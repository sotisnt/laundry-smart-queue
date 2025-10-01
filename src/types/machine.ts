export type MachineType = 'washer' | 'dryer';

export type MachineStatus = 'available' | 'in-use' | 'done';

export interface Program {
  id: string;
  name: string;
  duration: number; // in minutes
  type: MachineType;
}

export interface Machine {
  id: string;
  name: string;
  type: MachineType;
  status: MachineStatus;
  currentProgram?: Program;
  endTime?: Date;
  userId?: string;
  canPostpone?: boolean;
}

export const WASH_PROGRAMS: Program[] = [
  { id: 'quick-30', name: 'Quick Wash', duration: 30, type: 'washer' },
  { id: 'normal-60', name: 'Normal Wash', duration: 60, type: 'washer' },
  { id: 'eco-90', name: 'Eco Wash', duration: 90, type: 'washer' },
  { id: 'intensive-120', name: 'Intensive Wash', duration: 120, type: 'washer' },
];

export const DRY_PROGRAMS: Program[] = [
  { id: 'quick-45', name: 'Quick Dry', duration: 45, type: 'dryer' },
  { id: 'normal-75', name: 'Normal Dry', duration: 75, type: 'dryer' },
  { id: 'delicate-60', name: 'Delicate Dry', duration: 60, type: 'dryer' },
];
