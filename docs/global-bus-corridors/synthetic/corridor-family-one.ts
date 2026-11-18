import { writeFileSync, readFileSync } from "node:fs"
import { createHash } from "node:crypto"
import { negotiateLanes as routeBase } from "/workspace/bus-lanes-solver/lib/negotiate-lanes"
import { negotiateLanes as routeHead } from "/workspace/bus-lanes-work/lib/negotiate-lanes"
import { fixedCopper } from "/workspace/bus-lanes-work/lib/vector-scene"
import { length } from "/workspace/bus-lanes-work/lib/geometry"
import { validateRoutedCopperDrc } from "/workspace/bus-lanes-work/node_modules/@tscircuit/fanout-solver"
import type { SimpleRouteJson } from "/workspace/bus-lanes-work/lib/types"
const seed=Number(process.argv[2]),revision=process.argv[3],yieldBudget=1500
const lanes=8+seed%5,pitch=.25+.05*(seed%3),gap=.45+.15*(seed%4),outer=1.8+.45*(seed%3),barriers=1+seed%3
const sourceShift=.2*((seed%3)-1),targetShift=.4*((Math.floor(seed/3)%3)-1)
const input:SimpleRouteJson={layerCount:2,minTraceWidth:.1,minTraceToPadEdgeClearance:.1,minBoardEdgeClearance:.1,
 bounds:{minX:-6,maxX:6,minY:-6,maxY:6},
 connections:Array.from({length:lanes},(_,i)=>({name:`D${i}`,pointsToConnect:[{x:-4,y:(i-(lanes-1)/2)*pitch+sourceShift,layer:"top"},{x:4,y:(i-(lanes-1)/2)*pitch+targetShift,layer:"top"}]})),
 buses:[{busId:"data",connectionNames:Array.from({length:lanes},(_,i)=>`D${i}`)}],
 obstacles:Array.from({length:barriers},(_,i)=>i).flatMap(i=>[-1,1].map(sign=>{const opening=(i%2===0?1:-1)*.25*(seed%3);return {center:{x:(i-(barriers-1)/2)*2,y:sign*(outer+gap/2)/2+opening},width:.25,height:outer-gap/2,layers:["top"],connectedTo:["wall"]}}))}
const metadata={baseRevision:"202b034659fb96bad44d11b8190f4044b675116f",headSourceHashes:Object.fromEntries(["negotiate-lanes.ts","grid-visibility.ts","plan-bus-corridors.ts"].map(name=>[name,createHash("sha256").update(readFileSync(`/workspace/bus-lanes-work/lib/${name}`)).digest("hex")])),runtime:Bun.version,yieldBudget,seed,lanes,pitch,gap,outer,barriers,sourceShift,targetShift}
const path=`/tmp/corridor-family-${seed}-${revision}.json`
let reportedIterations=0,bestPartial=0,yields=0
const save=(extra:Record<string,unknown>={}):void=>writeFileSync(path,JSON.stringify({...metadata,revision,yields,reportedIterations,bestPartial,status:"running",...extra},null,2))
save()
const work=(revision==="base"?routeBase:routeHead)(input,input.connections,fixedCopper(input),[],new Map(input.connections.map(c=>[c.name,.1])),iteration=>{reportedIterations=Math.max(reportedIterations,iteration)})
let state=work.next()
while(!state.done&&yields<yieldBudget){bestPartial=Math.max(bestPartial,state.value.length);yields++;if(yields%100===0)save();state=work.next()}
const output=state.done?state.value:null
if(!state.done)work.return(null)
const connected=!!output&&output.length===lanes&&input.connections.every(c=>{const matches=output.filter(t=>t.connection_name===c.name);if(matches.length!==1)return false;return [matches[0].route[0],matches[0].route.at(-1)!].every((p,i)=>Math.hypot(p.x-c.pointsToConnect[i].x,p.y-c.pointsToConnect[i].y)<1e-8)})
const drc=output?validateRoutedCopperDrc({inputSrj:input,routedSrj:{...input,traces:output},clearance:.1,allowBlindAndBuriedVias:false} as any):null
save({status:state.done?(output?"completed":"returned_null"):"yield_budget_exhausted",completed:connected&&!!drc?.valid,connections:output?.length??0,bestPartial:Math.max(bestPartial,output?.length??0),drcValid:drc?.valid??null,connected,totalCopperLengthMm:output?.reduce((sum,t)=>sum+length(t.route),0)??null,longestRouteMm:output?Math.max(...output.map(t=>length(t.route))):null,input,output})
