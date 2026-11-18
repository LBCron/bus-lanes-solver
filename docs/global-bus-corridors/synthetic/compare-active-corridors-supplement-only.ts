import { writeFileSync } from "node:fs"
import { negotiateLanes as routeBase } from "/workspace/bus-lanes-solver/lib/negotiate-lanes"
import { negotiateLanes as routeHead } from "/workspace/bus-lanes-work/lib/negotiate-lanes"
import { planBusCorridors } from "/workspace/bus-lanes-work/lib/plan-bus-corridors"
import { fixedCopper } from "/workspace/bus-lanes-work/lib/vector-scene"
import { length } from "/workspace/bus-lanes-work/lib/geometry"
import { validateRoutedCopperDrc } from "/workspace/bus-lanes-work/node_modules/@tscircuit/fanout-solver"
import type { SimpleRouteJson,Trace } from "/workspace/bus-lanes-work/lib/types"

const yieldBudget=10000
function fixture(lanes:number):SimpleRouteJson {
 const outer=(lanes-1)*.3/2+1.2,gap=.4;
 return {layerCount:2,minTraceWidth:.1,minTraceToPadEdgeClearance:.1,minBoardEdgeClearance:.1,
 bounds:{minX:-5,maxX:5,minY:-outer-2.2,maxY:outer+2.2},
 connections:Array.from({length:lanes},(_,i)=>({name:`D${i}`,pointsToConnect:[{x:-3,y:(i-(lanes-1)/2)*.3,layer:"top"},{x:3,y:(i-(lanes-1)/2)*.3,layer:"top"}]})),
 buses:[{busId:"byte",connectionNames:Array.from({length:lanes},(_,i)=>`D${i}`)}],
 obstacles:[-1,1].map(sign=>({center:{x:0,y:sign*(outer+gap)/2},width:.3,height:outer-gap,layers:["top"],connectedTo:["wall"]}))}
}
const results:any[]=[]
for(const lanes of [16]){
 const original=fixture(lanes)
 const planning=planBusCorridors(original,original.connections,fixedCopper(original),new Map(original.connections.map(c=>[c.name,.1])))
 let plan=planning.next(),planningYields=0
 while(!plan.done){planningYields++;plan=planning.next()}
 for(const [revision,route] of [["base",routeBase],["head",routeHead]] as const){
  const input=structuredClone(original),widths=new Map(input.connections.map(c=>[c.name,.1]))
  let reportedIterations=0,progressReports=0,partial=0,last:Trace[]=[]
  const work=route(input,input.connections,fixedCopper(input),[],widths,(iteration)=>{reportedIterations=Math.max(reportedIterations,iteration);progressReports++})
  let state=work.next(),yields=0
  while(!state.done&&yields<yieldBudget){if(yields%1000===0)console.log(JSON.stringify({progress:true,revision,lanes,yields,reportedIterations}));partial=Math.max(partial,state.value.length);last=state.value;yields++;state=work.next()}
  const completed=state.done&&!!state.value,output=state.done?state.value:null
  if(!state.done)work.return(null)
  const drc=output?validateRoutedCopperDrc({inputSrj:input,routedSrj:{...input,traces:output},clearance:.1,allowBlindAndBuriedVias:false} as any):null
  const row={revision,lanes,guideCount:plan.value.size,planningYields:revision==="head"?planningYields:0,yields,yieldBudget,reportedIterations,progressReports,completed,returnedNull:state.done&&!state.value,budgetExhausted:!state.done,connections:output?.length??0,bestPartial:Math.max(partial,output?.length??0),drcValid:drc?.valid??null,totalCopperLengthMm:output?.reduce((sum,t)=>sum+length(t.route),0)??null,longestRouteMm:output?Math.max(...output.map(t=>length(t.route))):null}
  results.push(row);console.log(JSON.stringify(row));writeFileSync("/tmp/compare-active-corridors-supplement-only-results.json",JSON.stringify({baseRevision:"202b034659fb96bad44d11b8190f4044b675116f",head:"working tree supplement-only integration: unchanged queue, guided choices excluded from current bestChoice",runtime:Bun.version,yieldBudget,fixture:"5/8/16 evenly spaced legal lanes, fixed 0.8mm central aperture, wall extent scales with lane span",results},null,2))
 }
}
