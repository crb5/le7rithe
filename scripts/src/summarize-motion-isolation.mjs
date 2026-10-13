import { readFile, writeFile } from 'node:fs/promises';
const report=JSON.parse(await readFile(process.argv[2]||'reports/marketplace-motion-isolation.json','utf8'));
const median=values=>{
  const s=[...values].sort((a,b)=>a-b),m=Math.floor(s.length/2);
  return s.length%2?s[m]:(s[m-1]+s[m])/2;
};
const range=values=>({median:median(values),min:Math.min(...values),max:Math.max(...values)});
let seed=728391;
const random=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
const summary={
  buildHash:report.buildHash,settings:report.settings,
  interpretation:'Paired randomization of median differences (all 512 label swaps for nine pairs); paired bootstrap 95% CI, 20000 resamples. A regression requires >5%, CI above zero, and p<0.05. No rejection is not proof of zero effect.',
  pages:{},
};
for(const [path,conditions] of Object.entries(report.pages)){
  if(!conditions.on||!conditions.off||conditions.on.length!==9||conditions.off.length!==9)throw Error('Expected nine complete on/off pairs');
  const on=[...conditions.on].sort((a,b)=>a.round-b.round);
  const off=[...conditions.off].sort((a,b)=>a.round-b.round);
  if(on.some((r,i)=>r.round!==off[i].round))throw Error('Unpaired results');
  const result={sampleSizePerCondition:9,metrics:{},
    sameOwnJavaScriptTransfer:new Set([...on,...off].map(r=>r.localJsBytes)).size===1};
  for(const metric of ['lcpMs','tbtMs','cls','localJsBytes','totalJsBytes']){
    const a=on.map(r=>r[metric]),b=off.map(r=>r[metric]);
    const delta=median(a)-median(b);
    let extreme=0;
    for(let mask=0;mask<(1<<9);mask++){
      const sa=a.map((v,i)=>mask&(1<<i)?b[i]:v);
      const sb=b.map((v,i)=>mask&(1<<i)?a[i]:v);
      if(Math.abs(median(sa)-median(sb))>=Math.abs(delta)-1e-10)extreme++;
    }
    const bootstrap=[];
    for(let n=0;n<20000;n++){
      const indexes=Array.from({length:9},()=>Math.floor(random()*9));
      bootstrap.push(median(indexes.map(i=>a[i]))-median(indexes.map(i=>b[i])));
    }
    bootstrap.sort((x,y)=>x-y);
    const ci95=[bootstrap[Math.floor(bootstrap.length*.025)],bootstrap[Math.floor(bootstrap.length*.975)]];
    const percent=median(b)===0?null:100*delta/median(b);
    const p=extreme/(1<<9);
    result.metrics[metric]={on:range(a),off:range(b),difference:delta,percent,ci95,p,
      credibleRegression:percent!==null&&percent>5&&ci95[0]>0&&p<.05};
  }
  result.cpuAttribution={};
  for(const [mode,runs] of [['on',on],['off',off]]){
    const sourceGroups=new Set(runs.flatMap(r=>r.scriptCpu.map(s=>s.source)));
    result.cpuAttribution[mode]=[...sourceGroups].map(source=>({
      source,medianTotalMs:median(runs.map(r=>r.scriptCpu.filter(s=>s.source===source).reduce((sum,s)=>sum+(s.totalMs||0),0))),
    })).sort((a,b)=>b.medianTotalMs-a.medianTotalMs);
  }
  summary.pages[path]=result;
}
await writeFile('reports/marketplace-motion-isolation-summary.json',JSON.stringify(summary,null,2));
console.log(JSON.stringify(summary,null,2));
