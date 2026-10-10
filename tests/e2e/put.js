(plan)=>{const t=window.__t,S=t.S,E=t.E;for(const [type,n,size] of plan){let k=0;const o={size:size||1};const order=S.tiles.map((x,i)=>i).sort((a,b)=>{const A=S.tiles[a],B=S.tiles[b];return Math.hypot(A.x-7,A.y-7)-Math.hypot(B.x-7,B.y-7)});for(const i of order){if(k>=n)break;if(E.canPlace(S,type,i,o).ok){E.build(S,type,i,o);k++;}}}
t.refresh(true);}
