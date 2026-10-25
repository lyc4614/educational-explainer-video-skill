import React from 'react';import {Img,staticFile} from 'remotion';import {placeImage} from './motion.mjs';
export type AssetRecord={id:string,file:string,width:number,height:number,bounds:{x:number,y:number,width:number,height:number}};
export type SubjectPose={x:number,y:number,width:number,rotation?:number,opacity?:number};
/** Copy the source PNG to the current Remotion public directory without altering it. */
export const VisibleAsset:React.FC<{asset:AssetRecord,pose:SubjectPose,zIndex?:number}>=({asset,pose,zIndex=10})=>{const s=placeImage(asset,pose);return <>
 <div style={{position:'absolute',left:s.shadow.centerX-s.shadow.width/2,top:s.shadow.top,width:s.shadow.width,height:s.shadow.height,borderRadius:'50%',background:'rgba(0,0,0,.4)',filter:'blur(18px)',opacity:s.opacity,zIndex:zIndex-1}}/>
 <Img src={staticFile(asset.file)} style={{position:'absolute',...s.image,opacity:s.opacity,transform:`rotate(${s.rotation}deg)`,transformOrigin:s.transformOrigin,zIndex}}/>
 </>;};
