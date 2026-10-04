const fs = require('fs');

let popupHtml = fs.readFileSync('SIGMA_SIM/tsd_popup.html', 'utf8');

const startIdx = popupHtml.indexOf('  _drawRings(j,y,cW,xF,dayIdx,axis,cycle) {');
const endIdx = popupHtml.indexOf('  _drawBand(dir, band,');

if (startIdx !== -1 && endIdx !== -1) {
    const before = popupHtml.substring(0, startIdx);
    const after = popupHtml.substring(endIdx);
    
    const newDrawRings = `  _drawRings(j,y,cW,xF,dayIdx,axis,cycle) {
    const pIdx=this.state.todIdx;
    const tod=(j.dayPlans&&j.dayPlans[dayIdx])?j.dayPlans[dayIdx][pIdx]:null;
    if(!tod) return;
    const smIdx=(j.dayPlanMapIds&&j.dayPlanMapIds[dayIdx])?j.dayPlanMapIds[dayIdx]:0;
    const sm=(j.signalMaps&&j.signalMaps[smIdx])?j.signalMaps[smIdx]:null;
    if(!sm) return;
    const offset=this._getOffset(j.id,pIdx);
    const rH=12,gap=0.5,P=this.cfg.pad,ctx=this.ctx;
    const proceed=(axis==='ew')?[2,6]:[4,8], blocked=(axis==='ew')?[4,8]:[2,6];

    ctx.fillStyle='rgba(40,44,48,0.65)';ctx.fillRect(P.left,y-rH-gap-1,cW,(rH+gap)*2+2);

    const ring=(sp,yl,mv,bot)=>{
      if(!sp||!sp.length) return;
      const yP=bot?(y+gap):(y-gap-rH); let cur=0;
      sp.forEach((st,idx)=>{
        if(st<=0){cur+=st;return;}
        const yt=(yl&&yl[idx])?yl[idx]:0, gt=Math.max(0,st-yt);
        const mov=(mv&&mv[idx])?mv[idx]:0;
        
        const nextMov = (mv && mv[idx+1] !== undefined) ? mv[idx+1] : -1;
        const isContinuous = (mov !== 0 && mov === nextMov);

        for(let rep=-3;rep<=3;rep++){
          const t0=offset+cur+rep*cycle-this.state.viewOffsetT;
          const xS=P.left+t0*xF, xG=P.left+(t0+gt)*xF, xE=P.left+(t0+st)*xF;
          if(xE<P.left||xS>P.left+cW) continue;
          
          if(proceed.includes(mov)){
            ctx.fillStyle=bot?'#42a5f5':'#66bb6a'; 
            if(isContinuous) { this._seg(xS,yP,xE-xS,rH,cW); }
            else { 
                this._seg(xS,yP,xG-xS,rH,cW);
                if(yt>0){ctx.fillStyle='#ffee58';this._seg(xG,yP,xE-xG,rH,cW);}
            }
          } else if(blocked.includes(mov)){
            ctx.fillStyle='#ef5350';this._seg(xS,yP,xE-xS,rH,cW);
          } else if(mov>=1&&mov<=8){
            ctx.fillStyle='#5c6bc0';
            if(isContinuous) { this._seg(xS,yP,xE-xS,rH,cW); }
            else {
                this._seg(xS,yP,xG-xS,rH,cW);
                if(yt>0){ctx.fillStyle='#ffee58';this._seg(xG,yP,xE-xG,rH,cW);}
            }
          } else {
            ctx.fillStyle="rgba(220, 30, 30, 0.40)";
            if(isContinuous) { this._seg(xS,yP,xE-xS,rH,cW); }
            else {
                this._seg(xS,yP,xG-xS,rH,cW);
                if(yt>0){ctx.fillStyle='#ffee58';this._seg(xG,yP,xE-xG,rH,cW);}
            }
          }

          const segW = isContinuous ? (xE - xS) : (xG - xS);
          if (segW > 14 && mov > 0) {
              const mx = xS + segW / 2;
              const my = yP + rH / 2;
              ctx.save();
              ctx.fillStyle = '#ffffff';
              ctx.font = 'bold 10px "JetBrains Mono", monospace';
              ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
              ctx.strokeStyle = 'rgba(0,0,0,0.7)';
              ctx.lineWidth = 2;
              ctx.strokeText(mov >= 100 ? 'W' : mov, mx, my);
              ctx.fillText(mov >= 100 ? 'W' : mov, mx, my);
              ctx.restore();
          }

          ctx.fillStyle='rgba(255,255,255,0.15)';ctx.fillRect(xE-0.5,yP,1,rH);
        }
        cur+=st;
      });
    };
    ring(tod.splitA,sm.yellowA,sm.movA,false);
    ring(tod.splitB,sm.yellowB,sm.movB,true);
    
    ctx.strokeStyle = 'rgba(0,0,0,0.12)';
    ctx.setLineDash([2, 3]);
    ctx.beginPath();
    ctx.moveTo(P.left, y);
    ctx.lineTo(P.left + cW, y);
    ctx.stroke();
    ctx.setLineDash([]);
  }

`;
    
    fs.writeFileSync('SIGMA_SIM/tsd_popup.html', before + newDrawRings + after, 'utf8');
    console.log("Updated tsd_popup.html with new drawRings.");
} else {
    console.log("Could not find start/end indices:", startIdx, endIdx);
}
