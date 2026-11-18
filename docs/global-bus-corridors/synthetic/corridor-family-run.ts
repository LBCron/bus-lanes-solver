import { writeFileSync } from "node:fs"
const results=[]
const deadline=Date.now()+120000
for(const seed of Array.from({length:12},(_,i)=>i))for(const revision of ["base","head"]){
 const remaining=deadline-Date.now()
 if(remaining<100){results.push({seed,revision,status:"not_run_whole_batch_deadline"});continue}
 const child=Bun.spawn([process.execPath,"/tmp/corridor-family-one.ts",String(seed),revision],{stdout:"ignore",stderr:"pipe"})
 let timedOut=false
 const timer=setTimeout(()=>{timedOut=true;child.kill("SIGKILL")},remaining)
 const exit=await child.exited;clearTimeout(timer)
 const path=`/tmp/corridor-family-${seed}-${revision}.json`
 const result=await Bun.file(path).json()
 if(timedOut){result.status="whole_batch_external_timeout";result.completed=false;result.externalTerminated=true;writeFileSync(path,JSON.stringify(result,null,2))}
 result.exitCode=exit
 const {input,output,...summary}=result
 results.push(summary)
 writeFileSync("/tmp/corridor-family-results.json",JSON.stringify({wholeBatchExternalLimitSeconds:120,numberOfSeeds:12,results},null,2))
 console.log(JSON.stringify(summary))
 if(exit!==0&&!timedOut)console.log(await new Response(child.stderr).text())
}
writeFileSync("/tmp/corridor-family-results.json",JSON.stringify({wholeBatchExternalLimitSeconds:120,numberOfSeeds:12,results},null,2))
