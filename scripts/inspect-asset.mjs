import {readFileSync,writeFileSync,existsSync} from 'node:fs';import {resolve,basename} from 'node:path';import {pathToFileURL} from 'node:url';import {createRequire} from 'node:module';import {createHash} from 'node:crypto';

/** Measure pixels, not a checkerboard-looking preview. Input must be 8-bit RGBA. */
export function measureRgba(data,width,height,{kind='cutout',threshold=16}={}){
 if(!['cutout','scene'].includes(kind))throw Error('kind must be cutout or scene');
 if(!Number.isSafeInteger(width)||!Number.isSafeInteger(height)||width<1||height<1||data.length!==width*height*4)throw Error('invalid RGBA dimensions or byte count');
 if(!Number.isInteger(threshold)||threshold<1||threshold>255)throw Error('threshold must be 1..255');
 let left=width,top=height,right=-1,bottom=-1,min=255,max=0,zero=0,nonOpaque=0;
 for(let y=0;y<height;y++)for(let x=0;x<width;x++){const a=data[(y*width+x)*4+3];min=Math.min(min,a);max=Math.max(max,a);if(a===0)zero++;if(a<255)nonOpaque++;if(a>=threshold){left=Math.min(left,x);top=Math.min(top,y);right=Math.max(right,x);bottom=Math.max(bottom,y);}}
 if(right<0)throw Error('asset has no visible pixels at selected threshold');
 if(kind==='cutout'&&zero===0)throw Error('cutout requires real fully transparent pixels; opaque background is not a cutout');
 const bounds={x:left,y:top,width:right-left+1,height:bottom-top+1};
 return {width,height,alpha:{min,max,zeroFraction:zero/(width*height),nonOpaqueFraction:nonOpaque/(width*height),boundsThreshold:threshold},bounds,anchor:{kind:'visible-center',x:left+bounds.width/2,y:top+bounds.height/2}};
}
export async function inspectAsset(input,{id,kind='cutout',sharpModule='sharp',threshold=16}={}){
 if(typeof id!=='string'||!id.trim())throw Error('asset id is required');
 const bytes=readFileSync(input);if(!bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))throw Error('input must be a PNG');
 const require=createRequire(resolve(process.cwd(),'package.json'));let sharp;try{sharp=require(sharpModule);}catch{throw Error('sharp is unavailable: install it in the project or pass --sharp-module with a trusted installed module path');}
 const {data,info}=await sharp(bytes).ensureAlpha().raw({depth:'uchar'}).toBuffer({resolveWithObject:true});
 return {id,file:basename(input),kind,sha256:createHash('sha256').update(bytes).digest('hex'),...measureRgba(data,info.width,info.height,{kind,threshold})};
}
async function main(){
 const args=process.argv.slice(2),input=args.shift(),options={};if(!input||input.startsWith('--'))throw Error('Usage: node inspect-asset.mjs image.png --id report --kind cutout --out metadata.json [--sharp-module path]');
 const allowed=new Set(['--id','--kind','--out','--sharp-module','--threshold']);for(let i=0;i<args.length;i+=2){const key=args[i],value=args[i+1];if(!allowed.has(key)||value===undefined||value.startsWith('--')||key in options)throw Error('unknown, duplicate, or missing-value option: '+key);options[key]=value;}
 if(!options['--out'])throw Error('--out is required');const output=resolve(options['--out']);if(existsSync(output))throw Error('output already exists; choose a new versioned metadata file');
 const result=await inspectAsset(resolve(input),{id:options['--id'],kind:options['--kind']||'cutout',sharpModule:options['--sharp-module']||'sharp',threshold:options['--threshold']===undefined?16:Number(options['--threshold'])});writeFileSync(output,JSON.stringify(result,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify({status:'pass',output,id:result.id,kind:result.kind}));
}
if(process.argv[1]&&pathToFileURL(resolve(process.argv[1])).href===import.meta.url)main().catch(e=>{console.error(e.message);process.exitCode=1;});
