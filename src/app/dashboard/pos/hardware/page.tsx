import { Hardware } from '@/components/pos/Hardware';
import { hardwareViews } from '@/lib/hardware/server';
export default function HardwarePage(){return <Hardware hardwareViews={hardwareViews()}/>;}
