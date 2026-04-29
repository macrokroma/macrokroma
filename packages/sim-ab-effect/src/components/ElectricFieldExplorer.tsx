import { useState, useRef, useEffect, useCallback } from "react";

type Charge = { x: number; y: number; q: number; id: number; };

const CANVAS_SIZE = 560;
const FIELD_RANGE = 3;
const ARROW_GRID = 20;
const POTENTIAL_RES = 100;

function fieldToCanvas(fx: number, fy: number): [number, number] {
  return [((fx+FIELD_RANGE)/(2*FIELD_RANGE))*CANVAS_SIZE, ((FIELD_RANGE-fy)/(2*FIELD_RANGE))*CANVAS_SIZE];
}
function canvasToField(cx: number, cy: number): [number, number] {
  return [(cx/CANVAS_SIZE)*2*FIELD_RANGE-FIELD_RANGE, FIELD_RANGE-(cy/CANVAS_SIZE)*2*FIELD_RANGE];
}

function electricField(charges: Charge[], x: number, y: number): [number, number] {
  let ex=0, ey=0;
  for (const c of charges) {
    const dx=x-c.x, dy=y-c.y, r2=dx*dx+dy*dy+0.04, r=Math.sqrt(r2), r3=r2*r;
    ex += c.q*dx/r3; ey += c.q*dy/r3;
  }
  return [ex, ey];
}

function potential(charges: Charge[], x: number, y: number): number {
  let phi=0;
  for (const c of charges) { const dx=x-c.x,dy=y-c.y; phi += c.q/Math.sqrt(dx*dx+dy*dy+0.04); }
  return phi;
}

function drawArrow(ctx: CanvasRenderingContext2D, x: number, y: number, vx: number, vy: number, color: string, alpha: number = 1) {
  const mag=Math.sqrt(vx*vx+vy*vy); if (mag<0.001) return;
  const cellSize=CANVAS_SIZE/ARROW_GRID, maxLen=cellSize*0.42;
  const len=Math.min(Math.log(1+mag*0.5)*cellSize*0.25, maxLen);
  const nx=vx/mag, ny=vy/mag;
  const tipX=x+nx*len, tipY=y-ny*len, baseX=x-nx*len*0.15, baseY=y+ny*len*0.15;
  const headLen=len*0.35, cosA=Math.cos(0.4), sinA=Math.sin(0.4), dnx=nx, dny=-ny;
  ctx.globalAlpha=alpha; ctx.strokeStyle=color; ctx.lineWidth=1.1;
  ctx.beginPath(); ctx.moveTo(baseX,baseY); ctx.lineTo(tipX,tipY); ctx.stroke();
  ctx.fillStyle=color; ctx.beginPath(); ctx.moveTo(tipX,tipY);
  ctx.lineTo(tipX-headLen*(dnx*cosA-dny*sinA), tipY-headLen*(dny*cosA+dnx*sinA));
  ctx.lineTo(tipX-headLen*(dnx*cosA+dny*sinA), tipY-headLen*(dny*cosA-dnx*sinA));
  ctx.closePath(); ctx.fill(); ctx.globalAlpha=1;
}

let nextId = 100;
function makeCharge(x: number, y: number, q: number): Charge { return { x, y, q, id: nextId++ }; }

type ChargePreset = { label: string; charges: Charge[]; };
const CHARGE_PRESETS: ChargePreset[] = [
  { label: "Single +", charges: [makeCharge(0,0,1)] },
  { label: "Dipole", charges: [makeCharge(-0.8,0,1), makeCharge(0.8,0,-1)] },
  { label: "Two positive", charges: [makeCharge(-0.8,0,1), makeCharge(0.8,0,1)] },
  { label: "Quadrupole", charges: [makeCharge(-0.7,0.7,1), makeCharge(0.7,0.7,-1), makeCharge(-0.7,-0.7,-1), makeCharge(0.7,-0.7,1)] },
  { label: "Line of 3", charges: [makeCharge(-1.2,0,1), makeCharge(0,0,-2), makeCharge(1.2,0,1)] },
];

type OverlayMode = "arrows"|"potential"|"both";

export function ElectricFieldExplorer() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [charges, setCharges] = useState<Charge[]>(CHARGE_PRESETS[1]!.charges);
  const [overlay, setOverlay] = useState<OverlayMode>("both");
  const [dragging, setDragging] = useState<number|null>(null);
  const [probe, setProbe] = useState<[number,number]|null>(null);

  const draw = useCallback(() => {
    const canvas = canvasRef.current; if (!canvas) return;
    const ctx = canvas.getContext("2d"); if (!ctx) return;
    ctx.fillStyle="#0a0a0f"; ctx.fillRect(0,0,CANVAS_SIZE,CANVAS_SIZE);

    if (overlay==="potential"||overlay==="both") {
      const cellW=CANVAS_SIZE/POTENTIAL_RES;
      const vals:number[][]=[];
      let pMin=Infinity, pMax=-Infinity;
      for (let i=0;i<POTENTIAL_RES;i++) { vals[i]=[]; for (let j=0;j<POTENTIAL_RES;j++) {
        const [fx,fy]=canvasToField((i+0.5)*cellW,(j+0.5)*cellW);
        const v=Math.max(-8,Math.min(8,potential(charges,fx,fy)));
        vals[i]![j]=v; if(v<pMin)pMin=v; if(v>pMax)pMax=v;
      }}
      const range=pMax-pMin||1;
      for (let i=0;i<POTENTIAL_RES;i++) for (let j=0;j<POTENTIAL_RES;j++) {
        const centered=(vals[i]![j]!-pMin)/range*2-1;
        let r:number,g:number,b:number;
        if(centered>0){r=Math.round(200*centered);g=Math.round(60*centered);b=Math.round(40*centered);}
        else{r=Math.round(40*-centered);g=Math.round(60*-centered);b=Math.round(200*-centered);}
        ctx.fillStyle=`rgba(${r},${g},${b},0.45)`;
        ctx.fillRect(i*cellW,j*cellW,cellW+0.5,cellW+0.5);
      }
      // Equipotential contours
      ctx.strokeStyle="rgba(232,232,239,0.12)"; ctx.lineWidth=0.6;
      for (let c=1;c<14;c++) {
        const threshold=pMin+(c/14)*range;
        for (let i=0;i<POTENTIAL_RES-1;i++) for (let j=0;j<POTENTIAL_RES-1;j++) {
          const v00=vals[i]![j]!, v10=vals[i+1]![j]!, v01=vals[i]![j+1]!;
          if((v00-threshold)*(v10-threshold)<0){const t=(threshold-v00)/(v10-v00); ctx.beginPath(); ctx.arc((i+t)*cellW,j*cellW,0.5,0,Math.PI*2); ctx.stroke();}
          if((v00-threshold)*(v01-threshold)<0){const t=(threshold-v00)/(v01-v00); ctx.beginPath(); ctx.arc(i*cellW,(j+t)*cellW,0.5,0,Math.PI*2); ctx.stroke();}
        }
      }

      // Legend on canvas
      const barX=CANVAS_SIZE-24, barY=12, barW=10, barH=60;
      for (let i=0;i<barH;i++){
        const t=1-i/barH; const c=t*2-1;
        if(c>0){ctx.fillStyle=`rgba(${Math.round(200*c)},${Math.round(60*c)},${Math.round(40*c)},0.7)`;}
        else{ctx.fillStyle=`rgba(${Math.round(40*-c)},${Math.round(60*-c)},${Math.round(200*-c)},0.7)`;}
        ctx.fillRect(barX,barY+i,barW,1);
      }
      ctx.strokeStyle="rgba(42,42,58,0.6)"; ctx.lineWidth=0.5; ctx.strokeRect(barX,barY,barW,barH);
      ctx.fillStyle="rgba(136,136,160,0.6)"; ctx.font="9px monospace"; ctx.textAlign="center";
      ctx.fillText("φ>0",barX+barW/2,barY-3); ctx.fillText("φ<0",barX+barW/2,barY+barH+10);
    }

    if (overlay==="arrows"||overlay==="both") {
      const step=CANVAS_SIZE/ARROW_GRID;
      for (let i=0;i<ARROW_GRID;i++) for (let j=0;j<ARROW_GRID;j++) {
        const cx=(i+0.5)*step, cy=(j+0.5)*step;
        const [fx,fy]=canvasToField(cx,cy);
        const [ex,ey]=electricField(charges,fx,fy);
        drawArrow(ctx,cx,cy,ex,ey,"#e8e8ef",0.5);
      }
    }

    // Charges
    for (const c of charges) {
      const [cx,cy]=fieldToCanvas(c.x,c.y);
      const radius=10+Math.abs(c.q)*3;
      const grad=ctx.createRadialGradient(cx,cy,0,cx,cy,radius*2.5);
      if(c.q>0){grad.addColorStop(0,"rgba(239,68,68,0.3)");grad.addColorStop(1,"rgba(239,68,68,0)");}
      else{grad.addColorStop(0,"rgba(96,165,250,0.3)");grad.addColorStop(1,"rgba(96,165,250,0)");}
      ctx.fillStyle=grad; ctx.beginPath(); ctx.arc(cx,cy,radius*2.5,0,Math.PI*2); ctx.fill();
      ctx.fillStyle=c.q>0?"#ef4444":"#60a5fa"; ctx.beginPath(); ctx.arc(cx,cy,radius,0,Math.PI*2); ctx.fill();
      ctx.fillStyle="#fff"; ctx.font="bold 13px monospace"; ctx.textAlign="center"; ctx.textBaseline="middle";
      ctx.fillText(c.q>0?"+":"−",cx,cy+1);
    }

    // Probe
    if (probe && dragging===null) {
      const [px,py]=probe;
      const [cx,cy]=fieldToCanvas(px,py);
      const [ex,ey]=electricField(charges,px,py);
      ctx.strokeStyle="#f59e0b"; ctx.lineWidth=1.5; ctx.setLineDash([3,3]);
      ctx.beginPath(); ctx.arc(cx,cy,6,0,Math.PI*2); ctx.stroke(); ctx.setLineDash([]);
      drawArrow(ctx,cx,cy,ex,ey,"#f59e0b",1);
    }
  }, [charges, overlay, probe, dragging]);

  useEffect(() => { draw(); }, [draw]);

  const getFieldPos = useCallback((e: React.MouseEvent<HTMLCanvasElement>): [number,number] => {
    const rect=canvasRef.current?.getBoundingClientRect(); if(!rect) return [0,0];
    return canvasToField((e.clientX-rect.left)*CANVAS_SIZE/rect.width, (e.clientY-rect.top)*CANVAS_SIZE/rect.height);
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const [fx,fy]=getFieldPos(e);
    for (const c of charges) { if(Math.sqrt((fx-c.x)**2+(fy-c.y)**2)<0.3){setDragging(c.id);return;} }
  }, [charges, getFieldPos]);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const [fx,fy]=getFieldPos(e);
    if(dragging!==null){setCharges(prev=>prev.map(c=>c.id===dragging?{...c,x:fx,y:fy}:c));}
    else{setProbe([fx,fy]);}
  }, [dragging, getFieldPos]);

  const probeE = probe ? electricField(charges,probe[0],probe[1]) : [0,0];
  const probePhi = probe ? potential(charges,probe[0],probe[1]) : 0;

  return (
    <div className="flex flex-col gap-3 p-4 rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)] not-prose">
      <div className="flex flex-wrap gap-1.5">
        {CHARGE_PRESETS.map(p=>(
          <button key={p.label} onClick={()=>setCharges(p.charges)} className="px-2.5 py-1 rounded text-xs transition-colors bg-[var(--color-bg)] text-[var(--color-text-secondary)] border border-[var(--color-border)] hover:text-[var(--color-text-primary)]">{p.label}</button>
        ))}
      </div>
      <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed">Drag charges to move them. Red is positive, blue is negative.</p>
      <div className="flex gap-1.5">
        {(["arrows","potential","both"] as const).map(mode=>(
          <button key={mode} onClick={()=>setOverlay(mode)} className={["px-2.5 py-1 rounded text-xs transition-colors", overlay===mode ? "bg-[var(--color-accent)] text-white" : "bg-[var(--color-bg)] text-[var(--color-text-secondary)] border border-[var(--color-border)] hover:text-[var(--color-text-primary)]"].join(" ")}>
            {mode==="arrows"&&"E field only"}{mode==="potential"&&"Potential only"}{mode==="both"&&"E + potential"}
          </button>
        ))}
      </div>
      <div className="flex justify-center">
        <canvas ref={canvasRef} width={CANVAS_SIZE} height={CANVAS_SIZE}
          className="w-full max-w-[560px] rounded"
          style={{cursor:dragging!==null?"grabbing":"crosshair"}}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={()=>setDragging(null)}
          onMouseLeave={()=>{setDragging(null);setProbe(null);}}
        />
      </div>
      <div className="h-6 text-xs font-mono text-[var(--color-text-secondary)]">
        {probe && dragging===null ? (
          <span>
            <span className="text-[var(--color-text-primary)]">E</span>({probe[0].toFixed(1)}, {probe[1].toFixed(1)}) = ({(probeE[0] as number).toFixed(2)}, {(probeE[1] as number).toFixed(2)})
            {" · "}|E| = {Math.sqrt((probeE[0] as number)**2+(probeE[1] as number)**2).toFixed(3)}
            {" · "}<span className="text-[var(--color-accent)]">φ</span> = {probePhi.toFixed(3)}
          </span>
        ) : dragging===null ? (
          <span className="italic">Hover to probe E and φ. Drag charges to rearrange.</span>
        ) : null}
      </div>
    </div>
  );
}