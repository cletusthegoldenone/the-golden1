import { SimulationProvider } from '@/context/SimulationContext';

export default function TraderLayout({ children }: { children: React.ReactNode }) {
  return <SimulationProvider>{children}</SimulationProvider>;
}
