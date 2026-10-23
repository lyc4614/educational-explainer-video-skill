import React from 'react';import {useCurrentFrame} from 'remotion';import {VisibleAsset,AssetRecord,SubjectPose} from './VisibleAsset';import {travelPose,progress} from './motion.mjs';
type Frames={enterStart:number,enterEnd:number,dockStart:number,dockEnd:number,chartStart:number,chartEnd:number};
type Data={label:string,value:number,maximum:number,unit:string,sourcePhrase:string,evidenceStatus:'verified'};
/** An adaptable source-object -> dock -> verified-data example; no bundled topic images. */
export const LayeredExample:React.FC<{asset:AssetRecord,timing:Frames,from:SubjectPose,established:SubjectPose,dock:SubjectPose,chart:{x:number,y:number,width:number},data:Data,intermediate?:boolean}>=({asset,timing,from,established,dock,chart,data,intermediate=false})=>{
 const f=useCurrentFrame();if(timing.dockStart<timing.enterEnd||timing.chartStart<timing.dockEnd)throw Error('this example reserves time for the source to dock before data is revealed');
 if(data.evidenceStatus!=='verified'||!data.sourcePhrase||!Number.isFinite(data.value)||!Number.isFinite(data.maximum)||data.maximum<=0||data.value<0||data.value>data.maximum)throw Error('verified source data and a valid chart domain are required');
 const pose=f<timing.dockStart?travelPose(f,{start:timing.enterStart,end:timing.enterEnd,from,to:established,lift:20}):travelPose(f,{start:timing.dockStart,end:timing.dockEnd,from:established,to:dock,lift:40});const p=progress(f,timing.chartStart,timing.chartEnd);
 return <><VisibleAsset asset={asset} pose={pose}/><div style={{position:'absolute',left:chart.x,top:chart.y,width:chart.width,height:260,border:`1px ${intermediate?'dashed':'solid'} rgba(187,221,232,.2)`,borderRadius:24,background:'rgba(187,221,232,.04)',opacity:intermediate?1:p,padding:32,boxSizing:'border-box',fontFamily:'sans-serif',color:'#F3F0E8'}}>
 {intermediate?<div style={{fontSize:28}}>Reserved data region</div>:<><div style={{fontSize:34}}>{data.label}</div><div style={{fontSize:72,margin:'12px 0'}}>{data.value}<span style={{fontSize:28,marginLeft:12}}>{data.unit}</span></div><div style={{height:18,background:'rgba(187,221,232,.1)',borderRadius:6}}><div style={{height:18,width:`${100*data.value/data.maximum*p}%`,background:'#79CBD2',borderRadius:6}}/></div></>}
 </div></>;
};
