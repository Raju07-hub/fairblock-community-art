"use client";
import { useEffect, useState } from "react";
type Scope = "daily"|"weekly"|"alltime";
type Mode = "current"|"previous";

export default function LBControls({ onChange }:{ onChange:(v:{scope:Scope;mode:Mode})=>void }) {
  const [scope, setScope] = useState<Scope>("daily");
  const [mode, setMode] = useState<Mode>("current");
  useEffect(()=>{ onChange({scope, mode}); }, [scope, mode, onChange]);

  return (
    <div className="flex gap-3 items-center">
      <select value={scope} onChange={e=>setScope(e.target.value as Scope)} className="px-3 py-2 rounded-xl">
        <option value="daily">Daily</option>
        <option value="weekly">Weekly</option>
        <option value="alltime">All Time</option>
      </select>
      {scope!=="alltime" && (
        <select value={mode} onChange={e=>setMode(e.target.value as Mode)} className="px-3 py-2 rounded-xl">
          <option value="current">Current</option>
          <option value="previous">Previous</option>
        </select>
      )}
    </div>
  );
}
