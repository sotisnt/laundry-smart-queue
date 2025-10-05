import { QRCodeSVG } from 'qrcode.react';
import { Card } from "@/components/ui/card";

interface QRCodeDisplayProps {
  machineId: string;
  machineName: string;
}

const QRCodeDisplay = ({ machineId, machineName }: QRCodeDisplayProps) => {
  // Generate URL to machine page
  const qrUrl = machineId 
    ? `${window.location.origin}/machine/${machineId}`
    : window.location.origin;

  return (
    <Card className="p-4 flex flex-col items-center gap-3">
      <QRCodeSVG 
        value={qrUrl} 
        size={120}
        level="M"
        includeMargin={true}
      />
      <p className="text-sm font-medium text-center text-card-foreground">{machineName}</p>
    </Card>
  );
};

export default QRCodeDisplay;
